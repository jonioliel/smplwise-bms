# CR-LOCAL-ID-SWITCH-2442 - the Arx-users switch on its own tab

Owner request 17.11: Settings > Users and permissions > "משתמשי Arx" showed, while the feature is off, a note that sent the
administrator to "Settings > Security (security.local_identity)". No screen offers that setting (no frontend code wrote
`security.local_identity`), so the feature could only be turned on by calling the API by hand.

## What changed

- `frontend/src/screens/system-local-users.ts`
  - Off state: the note now says what off means ("cannot be created, none of them can sign in"). A system administrator gets the
    button "הפעלת משתמשי Arx" inside the note; anyone else reads "רק מנהל מערכת יכול להפעיל אותם." and gets no control.
  - On state: a system administrator gets a closing row "משתמשי Arx פעילים." + the danger button "כיבוי משתמשי Arx"
    (below the remote-address card). Nobody else sees that row.
  - Both directions open the shared `sw-dialog` as a confirmation. ON: people who exist only in Arx can be created and sign in
    through remote access; the remote sign-in page shows the "משתמש Arx" mode. OFF: every Arx-user sign-in ends at once, no sign-in
    until it is on again, reset codes already sent are cancelled; users, roles and passwords are kept. Nothing is sent before the
    confirmation; cancel / Escape / backdrop send nothing.
  - Confirm sends `PATCH /settings` with exactly `{"security.local_identity":"on"|"off"}`, then the tab reads
    `GET /identity/local-users` again, so the add / export / remote-address sections appear or leave. An open create form, a selected
    user and a shown link are closed by the switch. A status line confirms the result.
  - Errors use the tab's existing pattern (`.note.err`, `data-local-error`): the dialog closes and the server's own text is shown
    (403 "רק מנהל מערכת יכול להפעיל או לכבות את משתמשי Arx."), or "אין חיבור לשרת." when offline. The state does not change.
  - Styles: one rule (`.note .actions` top margin). Everything else is the screen's existing classes and `sw-button` variants.
- `frontend/src/i18n/local-identity.ts`: `off` reworded; new `offNotAdmin`, `onState`, `switchOn`, `switchOff`, `switchOnBody`,
  `switchOffBody`, `switchedOn`, `switchedOff` (Hebrew and English).
- `smplwise_vms/backend/smplwise/routers/local_identity.py`: `GET /identity/local-users` adds the read-only field
  `can_switch` (= `rbac.is_system_admin` for the caller). It only tells the tab whether to offer the switch. No rule changed: the
  PATCH in `routers/settings.py` remains the authority (system administrator only, 403 + audit `identity.local.feature` otherwise,
  audit `identity.local.feature_enabled` / `_disabled`, off revokes every local session and deletes live reset codes). An older
  server without the field simply shows no switch.

## Server rule, as found (not changed)

`security.local_identity` is NOT in `LOCAL_ONLY_IDENTITY_KEYS`: a system administrator's remote (HA-based) session may turn the feature
ON and OFF, unlike `security.local_identity_extended` (ON is local-channel only) and the sign-in shaping keys (public address,
passkey-first). The new backend test pins this as the current behaviour. Whether turning it ON should become local-channel only is
an owner question (below); nothing was changed.

In practice the tab is reached only by a system administrator: `identity.directory.read` is held by no other built-in role
(`test_permission_matrix`). `can_switch: false` therefore reaches only a custom-role holder or an administrator with an
installation-wide deny; the read-only text covers that case.

## The sign-in page's `local_identity` flag

- Server: `GET /auth/remote-config` follows the switch at once (`local_identity.flag_changed()`; asserted in the new backend test).
- Client: `frontend/src/arx/boot.ts` reads remote-config ONCE per page load (`bootRemote` -> `loadRemoteConfig`), and
  `showLogin` / `showWelcome` take `localEnabled` / `enabled` from that copy. So:
  - a sign-in page opened (or reloaded) after the switch shows / hides the "משתמש Arx" mode correctly; a sign-out reloads the page,
    so it always re-reads;
  - a sign-in page that was ALREADY open on another device keeps its old view until it is reloaded. After ON it does not offer the
    mode yet; after OFF it still shows the mode but every local sign-in is refused by the server;
  - the administrator's own running app does not use the flag after sign-in, so nothing there needs a reload.
  Not changed here (a periodic re-read on the sign-in page would be a separate small change).

## Tests actually run (workstation, no runner, no entry check)

- `npx tsc --noEmit`: exit 0.
- `npx playwright test tests/unit-arx-local-login.spec.ts tests/unit-service-identity.spec.ts tests/unit-uxrest2-295.spec.ts
  tests/unit-a11y-polished-lint.spec.ts --project=desktop --workers=1` (after `npx vite build`, private port): 45 passed.
  New in `unit-arx-local-login.spec.ts` (6): admin turns it on (nothing sent before confirm, cancel sends nothing, PATCH body exactly
  `{"security.local_identity":"on"}`, exactly one more list read, sections appear); off direction (warning text, danger button,
  exact PATCH, sections and the open create form leave); non-admin off state (text, no control); non-admin on state (no control);
  403 shows the server text; offline shows the connection text.
- `pytest tests/test_local_identity.py -p no:xdist`: exit 0 (whole file; includes the new
  `test_the_list_says_who_may_switch_and_the_remote_channel_may_switch_both_ways`).

## NOT_RUN

- Tablet / mobile Playwright projects for the new tests; the full frontend and backend suites; pixel runs; the runner entry check
  (by instruction).
- No check against the lab add-on (nothing installed).
- `npm run build:addon` (the shipped `www` bundle is not rebuilt on this branch).

## Pixels to refresh

None. No `pixel-*.spec.ts` renders this tab (searched for `tab=local`, `local-users`, `system-local-users`, `data-local`).
Evidence screenshots (not baselines, not committed here) that show the tab in its ON state change by the new closing row when the
mock gives `can_switch`: none of the existing mocks do, so `docs/evidence/USR2/settings-local-users-*.png` and
`evidence-access-polish-2331` `local-users*` stay as they are.

## Owner questions

1. Turning Arx users ON from a remote session (today: allowed for a system administrator, same as OFF).
   a. Keep as is (recommended: the person is already a system administrator in that session, and it matches the request to switch
      from this tab wherever the administrator works).
   b. ON only from the local channel (like the extended mode); OFF from anywhere.
2. A sign-in page already open on another device learns about the switch only after a reload.
   a. Leave it (recommended: a rare case, the server refuses correctly meanwhile).
   b. Re-read the flag on the sign-in page every few minutes / when the page regains focus.
