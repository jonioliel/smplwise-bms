# DEEP-REVIEW-2570-SECURITY-ADMIN - second deep review pass, area 1 (identity, sessions, second factor, push approval, admin screens)

Owner request: a second pass over the ground the 2.56 review listed as "Not covered". Area `SECURITY-ADMIN` (id prefix `SA2`).
Reviewed source: `v2.56.0` = `6ea807b2e` ("release: 2.56.0"), read-only worktree. Scope = the "Not covered" list at the end of
`docs/review/DEEP-REVIEW-2560-SECURITY-ADMIN.md` (branch `origin/review/DEEP-2560-SECURITY-ADMIN`):

1. the mobile shells, the push-approval contract seen from the phone;
2. the `system-*` admin screens that were not read (96 files, 41,721 lines);
3. an authorization sweep of ALL routers (about 210 router modules, 1,955 route decorators found; `contracts/API_INVENTORY.md`
   counts 1,962 routes);
4. the area's tests: run them, and sample how strong their assertions are.

No lab, no Home Assistant, no device, no product host, no secrets read. Findings of the 2.56 pass (SA-01, SA-02) are not repeated.

## 1. Summary

| Id | Severity | Status | Title | Where (at `6ea807b2e`) |
|---|---|---|---|---|
| SA2-01 | medium | CONFIRMED | A phone key can never be registered: no page and no native screen calls the registration; phone-key step-up, "approve on the phone" and the phone key as a sign-in factor are unreachable for every user, while the screens and the guide say "add a key in the Android app" | `frontend/src/api/factor-screens.ts:17-18`, `:31-34`, `:62`; `frontend/src/components/sw-device-keys.ts:20-24`, `:108`; `mobile/android-shell/.../BridgeScript.kt:185`; `.../WebActivity.kt:338-365`; `routers/device_keys.py:106`, `:123`, `:169`; `services/push_approval.py:94-98` |
| SA2-02 | low | CONFIRMED | The phone's own confirmation prompt shows a text the PAGE supplies, not what the signed payload says (purpose, action, the approval number): a script running in the page can have the person confirm one action while the key signs a step-up for another | `mobile/android-shell/.../WebActivity.kt:366-376`; `.../DeviceKey.kt:84-85`, `:228-262`; `frontend/src/api/factor-screens.ts:59-70`; `frontend/src/api/push-approval.ts:38-48` |
| SA2-03 | low | CONFIRMED | Settings > branding: a failed first read is silent and leaves a default form that an administrator can save over the stored values (installer profile: all four fields; brand colours: both colours) | `frontend/src/screens/system-brand-installer.ts:42-44`, `:115-116`, `:143`; `frontend/src/screens/system-brand-colors.ts:102-110`, `:126`; `routers/white_label.py:55-69` |
| SA2-04 | low | CONFIRMED (8 places read; 56 candidates) | Permission refusals raised by hand are not audited: of 148 hand-written `403` in the routers, 56 have no audit row next to them; eight real permission refusals were read and confirmed (door automations, wall, scene capture, another user's playback session, device activity of a lock / alarm panel, saved views, home tickets, wall calendar) | `routers/door_automations.py:46-47`; `routers/wall.py:47-48`; `routers/automations.py:387-388`; `routers/playback.py:76-77`; `routers/devices.py:188-189`; `routers/views.py:138-139`; `routers/home_family.py:144-145`; `routers/home_wall_events.py:82-83` |
| SA2-05 | low | CONFIRMED | Security tests that no release gate runs: the SFTP off-box backup tests are skipped on the runner because its Python environment lacks `paramiko` (seen in this pass's run); the three WebAuthn ceremony tests skip unless the page host is `localhost` (every gate lane uses `127.0.0.1`); the real-backend sign-in / second-factor / sessions specs are `"gate": false`, and two of them are not in the fixture list at all | `smplwise_vms/backend/tests/test_offbox_sftp.py:18`; `smplwise_vms/backend/requirements.txt:20`; `frontend/tests/unit-mfa-ha-passkey-2520.spec.ts:77`; `frontend/tests/unit-mfa-reset-channel-ui-2520.spec.ts:103`, `:136`; `frontend/playwright.config.ts:9`; `scripts/gate/release_gate.py:1816`, `:2188`, `:2936`; `frontend/tests/fixtures/fixture_specs.json:50-59`; `frontend/tests/evidence-arx-remote.spec.ts:23`; `frontend/tests/evidence-arx-admin-default.spec.ts:14` |
| SA2-06 | low | CONFIRMED | Calendar settings are saved as one whole document with no revision; the sync-rules screen sends the copy it loaded for a one-rule change, so it silently reverts every other calendar setting changed meanwhile - the guest-details retention included, which re-dates the erasure of stored guest details | `frontend/src/screens/system-calendar-sync.ts:324-335`; `frontend/src/api/calendars.ts:305`; `routers/calendar.py:116-130`; `services/calendar/model.py:279-284`; `services/calendar/guests.py:98-106` |

Counts: 0 critical, 0 high, 1 medium, 5 low.

The authorization sweep found **no route without a server-side permission check** and no fail-open path (section 4). The finding it
did produce is the audit gap SA2-04.

## 2. Findings

### SA2-01 (medium) - a phone key cannot be registered

**What exists.** The server side is complete: `POST auth/device-keys/challenge {purpose: "register"}` (`routers/device_keys.py:106`),
`POST auth/device-keys` (`:169`, registration with the attestation chain), the public sign-in challenge (`:123`) and the
`X-Arx-Second-Factor: dk1:...` answer. The Android shell is complete too: `window.ArxApp.deviceKey.create({authKind, payload})`
(`BridgeScript.kt:185`) -> `"deviceKeyCreate"` (`WebActivity.kt:338-365`) creates the Keystore key and answers the public key and the
attestation chain.

**What is missing.** Nothing calls them:

- `frontend/src/api/factor-screens.ts` has `listDeviceKeys` and `revokeDeviceKey` only (`:17-18`); its bridge type knows `status()` and
  `sign()` only (`:31-34`); the one challenge it asks for is `purpose: 'step_up'` (`:62`). `git grep` at `6ea807b2e` for
  `deviceKey.create`, `deviceKeyCreate`, `purpose: 'register'`, `auth/device-keys'` as a POST, `sign-in/challenge`, `dk1:` and
  `answer_prefix` over `frontend/src` (generated wire types aside) and over the built bundle `smplwise_vms/www/assets`: no caller.
- The shell is a WebView: its only uses of `DeviceKey.create` is the bridge message above; there is no native "add a key" screen
  (`ServersActivity.kt`, `WebActivity.kt`), and no `evaluateJavascript` that would start a registration.
- The list screen says so itself: "No add button: a key is created on the phone" (`sw-device-keys.ts:24`) and shows the person
  "אין מפתחות טלפון. מוסיפים מפתח באפליקציית Android." (`:108`). `docs/user-guide/he/82-second-factor_HE.md` describes phone keys and
  "אישור בטלפון" (lines 76, 95) and never says how a key is added. No change note lists the gap as open
  (`docs/changes/MFA-DEVICEKEY-2490.md:38` says the page comes in "slices 2 and 11"; `MFA-SCREENS-2510` built the list and the revoke).

**Effect.** No user can ever hold a phone key, so:

- the phone key as a step-up method (`sw-step-up-dialog.ts`, offered only when `ArxApp.deviceKey.status()` answers a key id) never appears;
- "approve on the phone" (CR-011 option D, `security.push_approval`, released in 2.53 and repaired in 2.56 as SA-01 / FE-06) can never
  be offered: `push_approval.available` needs `device_keys.has_active` (`services/push_approval.py:94-98`), and the phone-side watcher
  stops at start when the app has no key (`shell/push-approval-watch.ts:74-75`);
- the phone key as the second factor of the app's sign-in (owner Q51) has no client;
- the administrator's switches `security.push_approval`, `security.device_key_auth`, `security.device_key_attestation` and the
  "phone keys" rows of the account-security and user-factor screens describe something that cannot be switched on by anybody.

Fail-closed (nothing is weakened), but a documented security feature family is not reachable, and the fake-bridge specs
(`tests/mfa-screens-mocks.ts`) hide it: every test that shows a phone key starts from a mocked `GET auth/device-keys` row.

**Fix.** Add the enrolment flow to the page that runs inside the app (account security > phone keys, only when
`ArxApp.deviceKey` exists): `POST auth/device-keys/challenge {purpose: "register"}` -> `deviceKey.create({authKind, payload})` ->
`deviceKey.sign(payload, text)` -> `POST auth/device-keys {challenge_id, public_key, signature, auth_kind, attestation, label}` ->
`deviceKey.setKeyId(id)`; the step-up dialog of the client (`api/client.ts`) already handles the 403 `step_up_required` the server
answers for a user who has another factor. Three things to settle with it:

1. `DeviceKey.create` deletes the app's existing key BEFORE the new one is accepted (`DeviceKey.kt:147-148`). A registration that the
   server then refuses (step-up cancelled, `required` attestation on a phone that cannot attest, offline) leaves the phone without the
   key the server still lists as active. Create under a second alias and swap only in `setKeyId`.
2. The watcher reads the key id once at page start (`push-approval-watch.ts:74-75`): after an enrolment it must be started (or re-read)
   without a reload.
3. A real-phone check before the feature is announced (the 2.51 note already says the bridge was never exercised on a phone:
   `docs/changes/MFA-SCREENS-2510.md` open question 5).

Until then the three settings and the "phone keys" rows should say that the feature is not available yet, or be hidden.

### SA2-02 (low) - the phone's prompt does not show what is signed

**Where.** `WebActivity.kt:366-376`: for `"deviceKeySign"` the app checks that the payload is for its own server's origin, a known
purpose and its own key (`DeviceKeyPolicy.acceptable`) and then opens the phone's confirmation with
`subtitle = DeviceKeyPolicy.promptText(msg.optString("text"), ...)` (`DeviceKey.kt:84-85`) - the free text the page passed as the
second argument of `deviceKey.sign(payload, text)`. Nothing of the payload (`purpose`, `action`, for an approval the number inside
`auth.push_approval.n<NN>`) is shown. The pages pass honest texts today (`factor-screens.ts:59-70`, `push-approval.ts:38-48`,
`sw-push-approval-sheet.ts:124`).

**Scenario.** The step-up exists for the case of a taken-over session. A script that runs in the Arx page inside the app (an injected
script, a compromised dependency) asks the server for a `step_up` challenge with `action: "rbac.assign"` and calls
`deviceKey.sign(payload, "פתיחת דלת")` on the next thing the person does; the phone shows "פתיחת דלת", the person confirms with a
fingerprint, the signature is a valid step-up proof for the permission change. The same holds for an approval request another
session opened: the number typed is inside the signed text but the phone never displays the signed number or action itself.
Needs script execution in the Arx origin (the remote channel's CSP makes that hard), hence low; it becomes relevant the day SA2-01 is
fixed and phone keys exist.

**Fix.** Build the prompt in the app from the parsed payload: a fixed line per purpose and a short text per known action family
(`door.open`, `alarm.*`, `rbac.*`, `identity.*`, `auth.push_approval.n<NN>` -> "approve request, number NN"), the page's text only as a
second line or not at all. `DeviceKeyPolicyTest` gets the mapping.

### SA2-03 (low) - branding settings: a failed read leaves a savable default form

**Where.**
- `system-brand-installer.ts:115-116`: `this.canEdit = can('system.configure'); void getInstaller().then((r) => this.adopt(r)).catch(() => undefined);`
  The draft starts from the shared public brand view (`:43-44`, `brandLogo().wl`), which carries the installer profile only while the
  profile is switched ON (`:120-124`). `save()` sends the whole draft (`:143`, `putInstaller({ ...this.draft })`), and the route
  stores every field it receives (`routers/white_label.py:55-69`: `enabled`, `name`, `contact`, `accent`).
- `system-brand-colors.ts:102-110`: the same shape; `save()` always sends both `ui.accent` and `ui.toggle_on` (`:126`).

**Scenario.** The installer prepared a profile (name, contact line, accent) and left it switched off. Later the administrator opens
Settings > branding while the read fails once (a restart of the add-on, a network blip): no error is shown, the form is empty and
editable. He switches the profile on and saves: the stored name and contact line are replaced by empty text and the accent by the
default, and the customer-facing screens show an empty installer brand. Brand colours: picking only the accent colour after a failed
read also writes the default switch colour over the stored one. Recoverable by typing the values again; nothing else is touched.

**Fix.** Keep `canEdit` false until the first read succeeded and show the read error with "try again" (as `system-security-public.ts`
and the other settings cards do); send only the fields that differ from the loaded values.

### SA2-04 (low) - refusals raised by hand are not audited

**Rule.** `rbac.require` writes the audited `denied` row for every refusal (`rbac.py:375-381`); the domain authorities do the same
(`intercom_authority.require_anywhere`, the tickets `refuse` helpers). A handler that asks `authorize` / `permissions_anywhere` / a
domain helper and raises the 403 itself writes nothing, and there is no global hook (`main.py:174-177` only shapes the answer).

**Measured.** 148 hand-written `raise forbidden(...)` / `ApiError(403, ...)` in `routers/`; 56 have no audit call in the six lines
before them. Many of the 56 are not permission refusals (wrong code, "not an Arx-only identity", a feature switch). Read and confirmed
as real permission refusals with no audit row:

| Where | Refusal |
|---|---|
| `routers/door_automations.py:46-47` | no `access.doors.automate` anywhere (arming an automation's "open a door" block) |
| `routers/wall.py:47-48` | no `wall.view` |
| `routers/automations.py:387-388` | scene capture of an entity outside the caller's scene-manage scope |
| `routers/playback.py:76-77` | another user's playback session |
| `routers/devices.py:188-189` | the activity log of a lock / alarm panel without a permission that operates it |
| `routers/views.py:138-139` | deleting a saved view of another user |
| `routers/home_family.py:144-145` | home tickets without view / create |
| `routers/home_wall_events.py:82-83` | wall calendar: no family calendar the caller may book |

**Scenario.** A person probing what he may do (door automations, another user's playback session, a lock's activity) leaves no trace
in the audit log, while the same probe on a route that uses `rbac.require` does. The audit screen then under-reports refused attempts
exactly on some door- and video-related routes.

**Fix.** One helper `refuse(conn, principal, action, reason, resource...)` that audits (aside, so the row survives the rollback of the
request) and returns the 403; replace the eight above and sweep the other 48 with the list from the scan
(`grep -n "raise forbidden(\|ApiError(403" routers/`), leaving wrong-code / self-service answers as they are. A ratchet test that
counts un-audited 403 raises keeps it.

### SA2-05 (low) - security tests that no gate runs

**Where and why.**
- `tests/test_offbox_sftp.py:18` `paramiko = pytest.importorskip("paramiko")`: on the runner the import fails and the file's six
  tests (push / verify / prune over a real SFTP server, the fingerprint pin, "a different host key is refused before
  authentication", a wrong client key, a closed port, RSA keys over SHA-2) are reported as one skip. Observed in the
  run of section 3; the gate uses the same environment (`~/gate2/release_gate2.sh` puts `~/smplwisebms/.venv/bin` first on `PATH`).
  `paramiko` is a pinned product requirement (`requirements.txt:20`), so a skip is never the right answer for this file.
- `unit-mfa-ha-passkey-2520.spec.ts:77` ("the ceremony: the sign-in asks, the passkey answers in the header, a cancelled ceremony
  keeps..."), `unit-mfa-reset-channel-ui-2520.spec.ts:103` and `:136` (the enrol-first ceremony and its cancel):
  `test.skip(new URL(page.url()).hostname !== 'localhost', 'WebAuthn needs a localhost page ...')`. Every lane that runs page specs
  builds its address as `http://127.0.0.1:<port>/` (`playwright.config.ts:9`; `scripts/gate/release_gate.py:1816`, `:2188`, `:2936`;
  `scripts/fixture_job.py:218`). These three tests are skipped in every gate and every fixture job; they run only by hand with
  `SW_BASE_URL=http://localhost:<port>/`.
- `evidence-arx-second-factor.spec.ts` (enrol, sign in with the code, no replay, administrator reset), `evidence-arx-sessions.spec.ts`
  (an administrator revokes a sign-in; sign out everywhere) and `evidence-local-user-create-2438.spec.ts` are `"gate": false`
  (`fixture_specs.json:55-57`); `evidence-arx-remote.spec.ts` (the remote sign-in itself, the PKCE fallback) and
  `evidence-arx-admin-default.spec.ts` skip without `SW_ARX_FIXTURE=1` (`:23`, `:14`) and are not in `fixture_specs.json`, so
  neither the gate nor the fixture job's list runs them.

**Effect.** The SFTP target of the off-box backup - the code that decides whether a backup really left the site, and that checks the
remote host's key - has no test that runs. For the browser flows the server rules are covered by the backend tests (section 3), but
the only end-to-end proof that the sign-in page, the second step, the passkey ceremony and the session screens work against a real
backend is a manual run, and a regression in the page (for example in the header the passkey answer travels in) passes every gate.

**Fix.** Install the pinned requirements into the runner's environment (`pip install -r requirements.txt -c constraints.txt`) and
replace the `importorskip` by a plain import, so a missing requirement fails the lane; a gate step that fails on any
"collection skipped" would have caught it. Serve the unit-page lane (and the fixture lanes) on `http://localhost:<port>/` instead of `127.0.0.1` - WebAuthn takes
`localhost` as a relying-party id and never an IP address, so the guards themselves are right; then make an all-skipped ceremony a
failure of the lane. Set `"gate": true` for `evidence-arx-second-factor` and `evidence-arx-sessions` (desktop only, no pixel baseline) and add
`evidence-arx-remote` / `evidence-arx-admin-default` to the `arx` group.

### SA2-06 (low) - a stale screen reverts the calendar settings, the guest retention included

**Where.** `PUT /calendar/settings` takes a WHOLE settings document, fills missing keys from the defaults
(`services/calendar/model.py:279-284`) and stores it when anything differs (`routers/calendar.py:116-130`); there is no revision and
no "only these keys". When `guest_retention_days` is among the changed keys it re-dates the erasure of every stored guest record
(`guests.recompute_all`, `services/calendar/guests.py:98-106`). The sync-rules screen changes one rule by sending the document it read
when it opened: `this.s = { ...this.s, [k]: v }; await this.api.saveSettings(this.s)` (`system-calendar-sync.ts:324-335`,
`api/calendars.ts:305`).

**Scenario.** Administrator A has Settings > calendars > sync open (a second tab, a wall-mounted admin PC). Administrator B raises
the guest-details retention from 30 to 365 days in the calendars settings, or switches guest details on. Later A flips one sync rule
("deleted outside: cancel / flag"): the screen sends its old copy, the server stores retention 30 again (and whatever else B changed
goes back), `recompute_all` moves every guest record's erasure date back, and the next janitor run erases the names and phone
numbers B meant to keep. No error, no notice; the audit row of A's save names the keys that changed, which is the only trace.
Needs two sessions and a stale screen, hence low; the erasure itself cannot be undone.

**Fix.** Give the document a revision (`409 revision_conflict` like the other settings documents: tickets, emergency readiness) or
let the route take a partial document and merge it into the stored one; the sync-rules screen then sends `{[k]: v}` only.

## 3. Tests run and their results

Run on the runner through `~/work/slotb.sh`, job `~/work/p2570r_sa_run.sh`, worktree `~/work/review2-2570-sa` at `6ea807b2e`,
one pytest process per 12 files, `SW_WIRE_STRICT=1`; the node-only unit specs with `playwright.unit.config.ts --workers=2`.

| Run | Scope | Result |
|---|---|---|
| Backend, 13 pytest processes | the 146 test files of the area (identity, sessions, remote sign-in, second factor, passkeys, phone keys, step-up, push approval, app refresh / session, tokens, roles and bindings, HA users, home interface, backup and off-box, bridge key, cast, setup, system update, body limit, inventories) | **3,158 passed, 2 skipped, 0 failed, 0 errors** (every process exit 0; 49 min of slot B) |
| Frontend, node-only unit specs | 41 `unit-*.spec.ts` of the area named on the command line; the config leaves the page specs out | **207 passed, 0 failed** (34.7 s) |
| Frontend page specs (evidence / layout / pixel, unit specs that open a page) | - | NOT_RUN |
| Android unit tests (`mobile/android-shell/app/src/test`) | - | NOT_RUN (no Gradle run; read only in part) |

Per process (file order, 12 files each): 249, 414, 168, 313, 311, 179, 281 (+1 skipped), 248, 246 (+1 skipped), 132, 358, 187, 72.

The two skips:

- `tests/test_secfix2_pub04_timing_measure.py::test_measure_portal_start_known_vs_unknown` - an opt-in measurement
  (`SW_MEASURE_PORTAL_START=1`), skipped by design.
- **`tests/test_offbox_sftp.py` - the whole file (6 tests of the SFTP off-box backup target) is skipped at collection:
  "could not import 'paramiko'"** (`pytest.importorskip("paramiko")`, line 18). `paramiko==5.1.0` is a pinned requirement of the product
  (`smplwise_vms/backend/requirements.txt:20`) and the service imports it (`services/offbox_sftp.py:54`, `:108`), but the runner's
  virtual environment `~/smplwisebms/.venv` - the one the release gate puts first on its `PATH` - does not have it. So these six
  tests are skipped, silently and green, in every run on the runner, the gate included. Recorded under SA2-05.

One warning worth a look by the owner of the file: a test of chunk 11 raises Pillow's `DecompressionBombWarning` (an image of
118,810,000 pixels against the 60,000,000 limit) - expected if the test feeds an oversized picture on purpose; not followed further.

Static checks on the PC (one small process each):

| Check | Result |
|---|---|
| Route inventory by AST over `smplwise/routers/**` and a whole-package call graph (does a route reach `rbac.require / authorize / require_system_admin / is_system_admin / permissions_anywhere`, directly, through a gate dependency or through a service) | 1,955 route decorators; 1,787 reach an rbac decision; the other 168 were read by hand (section 4) |
| Hand-written 403 without an audit call nearby | 56 of 148 (SA2-04) |
| `authorize(...)` whose result is not used; `require(...)` inside `try`; `except ...: pass / continue` in routers | none (the three bare `authorize(conn)` in `services/nvr_batch.py` / `nvr_settings.py` are callbacks that raise) |
| Backend tests of the area with no `assert`, no `pytest.raises` and no asserting helper (146 files, 2,172 tests, AST) | 2: `test_home_interface.py:285` and `test_onboarding_2530.py:76`, both "must not raise" tests - legitimate |
| Frontend specs of the area with no `expect` (99 files, 445 tests) | none apart from screenshot / evidence-page producers; conditional skips: SA2-05 |
| `system-*.ts` (96 files): `unsafeHTML`, `innerHTML`, `insertAdjacentHTML`, `srcdoc`, secrets in `localStorage` / `sessionStorage`, `setInterval` without `clearInterval`, window / document listeners without removal, a `catch` that replaces a failed read with a default form | none (the only storage uses: hidden automation templates, the id of the running update); the silent-read pattern: SA2-03 |

## 4. Checked and fine

### Authorization sweep (all routers)

Method: every route decorator (`@router.<method>`, `guarded_route.post`, WebSockets) was listed with its dependencies; a call graph over
the whole backend package marked the routes that reach an rbac decision; the rest was read handler by handler, down into the service
function that takes the principal.

- **Gate presence.** Every one of the 1,955 routes either resolves an identity (`current_principal`, `current_principal_ro`,
  `principal_light`, `media._principal_for_ws`, a `read_gate(...)` factory) and reaches a permission or ownership check before data is
  returned or changed, or is one of the 26 routes that are public by design.
- **The 26 public routes**, each bounded: remote sign-in / sign-out / remote-config / app download / CSP report (`routers/remote.py`:
  remote channel only, per-address limits, fixed file path, nothing kept but counters), the app refresh family (`routers/app_refresh.py`:
  guard-first route class, per-client and per-family buckets, the same answer for unknown devices), the phone-key sign-in challenge
  (`routers/device_keys.py:123`: per-address limit, never says whether a key exists), the public brand view and stamped logos
  (`routers/brand.py`, `routers/white_label.py`: SVG only after `svg_sanitize`, `nosniff`, a CSP on SVG, nothing public while the
  profile is off), the notice-board TV routes (`routers/notices.py` -> `services/notices/display.py`: one 256-bit token per board,
  only its SHA-256 stored, constant-time compare, the same 404 for every miss, per-token limit), the calendar feed
  (`routers/calendar_feeds.py:413`, its own token connection).
- **Gate factories** read and confirmed: `access_control_base._gate / _credentials_admin_ro / _configure_gate`,
  `people_writer()`, `wiskey_installer_common.installer_gate / installer_reader`, `access_control_schedule_writes._admin_ro`,
  `devices._configure_holder_ro`, `system_update._holder_ro`, the module gates of tickets / maintenance / docread / emergency readiness.
- **Service-gated families** read (the handler passes the principal, the service refuses): tickets (`Viewer`, `access.require_visible`,
  `rfq.require_visible` + costs permission before a vendor file is looked up; 9 of the 22 ticket routers read, the rest by their
  call-graph mark), ticket intake (`require_handler / require_list_manager / CONFIGURE`), emergency readiness
  (`Viewer.require_view / require_manage` in every service entry), camera discovery (`require` in every manager entry; a job is visible
  to its owner or a system administrator, else 404), compliance export (stations where the caller holds both export and people read),
  calendar (`Ctx`, role in the calendar, `Denied` -> audited), temperature (units filtered by `ta.Scope` before events, reports and CSV),
  visitors and station permissions (`_own_or_404`, service-side decisions), offline field (own data by ticket visibility; a tag is
  verified by its signature), insights (`ic.Scope`), home wallpapers / prefs / notification settings (the caller's own rows only).
- **Own-object routes** (no permission by design, ownership checked): tokens, push subscriptions (another user's id answers 404 and is
  audited), phone keys, Arx session labels (`chain_owner`), saved table views, listen / talk session stop, presence "me".
- **Admin routers of this area** by their permission: `settings` PATCH (`system.configure`), `backup*` (`backup.manage`), `storage`,
  `setup`, `service_identity`, `fleet`, `cast` admin (`system.configure`), `system_update` (`system.update`, body after the gate),
  `ha_users` (`users.ha_manage`), `partner` (`partner.manage`), `app_secrets`, `ha.py` (entity actions: control permission on the
  entity's placement, door and unlock permissions for locks).
- **No fail-open**: no ignored `authorize` result, no swallowed refusal, `home_interface.enforce` passes only on "no such table"
  (a database from before the policy table) and re-raises every other database error.

### Mobile shell (Android)

Read in full: `DeviceKey.kt`, `BridgeScript.kt`, `WebPolicy.kt`, `DeepLinks.kt`, `ServerUrls.kt`, `AppLock.kt` (the lock bookkeeping and cover);
in `WebActivity.kt` the bridge listener and the phone-key handler, the WebView settings, the navigation / SSL / renderer client and
the permission and dialog handling.

- The phone-side contract matches the server: payload `arx-device-key|v1|<purpose>|<origin>|<user>|<key>|<action>|<nonce>`, 8 fields,
  nonce `dkn_` + 43 characters (`secrets.token_urlsafe(32)`, inside the app's 40-60), key id `dk_` + 24 hex, the push-approval action
  `auth.push_approval.n<NN>` passes the app's action pattern, the purpose of an approval is `step_up`; the app signs only for its own
  server's canonical origin and its own key id, a register payload only without a key id, a sign-in payload only without a user.
- The key: EC P-256 in the Keystore, user authentication required for every signature (`setUserAuthenticationParameters(0, ...)`, below
  API 30 biometric only), voided by a new fingerprint, StrongBox when present, attestation challenge = SHA-256 of the register payload.
- The bridge: `addWebMessageListener` limited to the server's origin, main frame only, and the page shown must be under the server's
  Arx path; nothing is answered while the app lock is up; `create` and `remove` need a recent tap; one prompt at a time.
- The WebView: no file / content access, no mixed content, no third-party cookies, certificate errors never proceed, a main-frame
  request outside the server gets an empty 403, back / forward and restored history re-checked, external links throttled without a
  tap, only the microphone may be granted and only to the server's origin and never while locked, page dialogs refused while locked.
- Deep links: `arx://open` only to a stored server and only its entry page; a link that asks for an action is confirmed first.
  Server addresses: credentials in the authority, non-http(s) schemes, dot segments (encoded too), control characters and
  backslashes are refused before parsing; a target is in scope only on the stored origin and under the stored path.
- `mobile/ios-shell` holds hand-off documents and brand files only - there is no iOS code in the repository to review.

### Admin screens

Logic read in full (state, load, save, delete; templates skimmed): `system-wizard`, `system-cast` (both components),
`system-storage`, `system-onboarding`, `system-app-signin`, `system-emergency-open`, `system-local-users`, `system-ha-users`,
`system-service-identity`, `system-update`, `system-setup`, `system-security` (the tab shell), `system-security-public`,
`system-wiskey-pairing`, `system-doors` (grants and mapping), `system-alarm`, `system-messaging-accounts`, `system-calendar-sync`,
`system-door-blocks`, `system-security-wiskey-managed` (to its poll loop), and the load / save paths of `system-mobile-options`,
`system-xs-options`, `system-nav-size`, `system-timeline-colors`, `system-brand-colors`, `system-brand-installer`.

- Failed reads show an error state or keep the card non-editable (`canEdit` false until the read answered) everywhere read, except SA2-03.
- Passwords never outlive their dialog (`system-ha-users` clears the draft on close and on error; `system-local-users` clears on close,
  on user switch and after a save); edit state is dropped when another user is selected.
- Destructive and physical actions ask first and name the object (remove a user: typed user name; NVR alarm output pulse: confirmation
  naming the recorder, nothing sent when the recorder changed meanwhile, an unknown outcome is said as unknown; door grants: a
  confirmation, the switch returns when cancelled).
- Idempotency keys on create-user and update-apply; busy guards on every save read; the update run id in `sessionStorage` is an id only.
- Server-supplied links are bound to `href` by Lit (no HTML injection); no screen builds HTML from data.

### Tests

- Backend: 2,172 tests in the 146 files of the area; assertion strength sampled by AST (above) and by reading
  `test_home_interface.py`, `test_onboarding_2530.py` and the refusal tests listed by the scan - they assert status and code, and the
  state after the call where a write is refused.
- Frontend: `unit-push-approval-fix-2560.spec.ts` read in full - it drives the real `look()` and `pushPollRetryDelay()` with injected
  dependencies and would fail without the 2.56 fix.

### Improvements (short, not findings)

- `system-security-wiskey-managed.ts:117-129`: `refresh()` always calls `schedulePoll()`; a refresh that is in flight when the screen
  is left re-arms the 2-second poll on the detached element, and it keeps reading `GET` until the WisKey job ends. Bounded by the
  job; a `this.isConnected` test in `schedulePoll` ends it.
- `shell/push-approval-watch.ts:74-75`: the watcher decides once, at page start, whether the app holds a phone key (part of SA2-01's fix).

## 5. Still not covered (honest list)

- **Object-level depth outside this area.** The sweep proves that every route has a gate and read the scope rule of the families
  listed in section 4. It did not prove, route by route, that every id in a path or body is tied to the scope that was checked, for:
  13 of the 22 ticket routers, the `access_control_*` people / credential / schedule writes, `energy_*`, `water*`, `generator`,
  `multimedia`, `plans / plan_*`, `anchors`, `zones`, `cases`, `incidents`, `exports`, `recordings`, `nvr_*`, `frigate*`,
  `automations` (other than scene capture). Their own area reviewers read those files.
- **Listeners outside the main app**: the public tickets server (`services/tickets/public_*`), the partner API listener, the LAN
  listener and the cast relay were not part of the router sweep (the LAN listener was read in the 2.56 pass).
- **Admin screens not read**: about 55 of the 96 `system-*.ts` files were covered only by the pattern scans of section 3, among them
  `system-notifications`, `system-tickets`, `system-tabs*`, `system-readiness`, `system-notices`, `system-intercom-ops`,
  `system-calendars`, `system-fleet-report`, `system-multimedia*`, `system-automations`, `system-access-*`, `system-mapping`,
  `system-wiskey-validation`, `system-devices`, `system-schedules`, `system-plan-view`, `system-look`, `system-wall`, `system-design`,
  `system-building-presence`, `system-presence*`, `system-security-cameras`, `system-security-privacy-masks`,
  `system-security-wiskey` / `system-access-wiskey`, and the render templates of the screens whose logic was read.
- **Android**: `ServersActivity.kt`, `ServerCheck.kt`, `ServerStore.kt`, the download path of `WebActivity.kt`
  (lines 760-900) and the Kotlin unit tests were not read; nothing was built or run on a phone or an emulator.
- **Tests**: the Playwright page specs (evidence / layout / pixel and the unit specs that open a page) were not run - only the
  node-only unit specs; assertion strength of the frontend specs was sampled by scan and one file, not read spec by spec.
- The lab carry-overs of the 2.56 pass stay open and untouched (what go2rtc sends for an `ffmpeg:` source; the lab bridge key-store
  check before a re-pair).
