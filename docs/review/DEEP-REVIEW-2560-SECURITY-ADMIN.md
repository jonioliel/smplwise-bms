# DEEP-REVIEW-2560-SECURITY-ADMIN - final deep review, area 1 (identity, sessions, second factor, push approval, off-box, admin screens)

Owner request: one final deep review of the whole product after 2.55. Area `SECURITY-ADMIN` (id prefix `SA`) of
`docs/review/FINAL-REVIEW-PLAN-2560.md` section 3. Reviewed source: `origin/release/2560-train` at
`57de3270cf36570a01f0af72607340fad6b48648` ("release: 2.56.0 - rebuilt UI at fc170982f"), read-only worktree. Range of new code:
`v2.52.0..57de3270c` restricted to the paths of the area (33 files, +2,217 / -95 in the hand-written paths listed by the plan).
No lab, no Home Assistant, no device, no product host.

What was actually run (on the PC, one small process each; nothing else was executed):

| Check | Result |
|---|---|
| SA-01: a standalone script driving `services.ha_user_auth.RateLimiter` (the limiter the push-approval routes use) with a fake clock and the `PHONE_LIMITS` of `routers/push_approval.py` | phone watcher alone (one call per 5 s): first refusal after 1,505 s (~25 min); phone visible for a minute before the request + requester polling every 2 s: the requester's state poll is refused 38 s after the request opened (TTL 90 s) - **reproduced** |
| SEC-3 ratchet: every `"security.*"` / `"remote.*"` string literal of the backend checked against `services.backup.SETTINGS_KEEP` | only notification category / text keys and three non-security remote settings (`remote.max_live_streams`, `remote.default_profile`, `remote.wall_profile`) are outside the list - no sign-in policy key is restorable |
| Backend / frontend test files of the area | NOT_RUN (the PC Python has no FastAPI; the runner is busy with the 2.56 gate and was not used) |

## 1. Summary

| Id | Severity | Title | Where (at `57de3270c`) |
|---|---|---|---|
| SA-01 | medium | Push approval: the phone's background poll and the requester's 2-second poll share one per-user rate bucket whose minute cap equals the requester's own poll rate; an approval that takes more than ~40-55 s fails on the requesting screen, and a phone app kept open for ~25 min disables push approval for the rest of the hour | `routers/push_approval.py:42-43`, `:118`, `:141`, `:151`; `frontend/src/shell/push-approval-watch.ts:10`, `:39-42`; `frontend/src/components/sw-step-up-dialog.ts:17`, `:322-343` |
| SA-02 | low | SEC-8 follow-up: re-pointing a Google Drive off-box target to another Google account (`gdrive/connect` + `gdrive/poll`) and importing an off-box key stay reachable from the remote channel, although "add / edit a target" and the key export are now local-only | `routers/backup_offbox.py:371-386`, `:388-403`, `:475-485`; `services/offbox_keys.py:160-179`; `services/offbox_restore.py:131` |

Counts: 0 critical, 0 high, 1 medium, 1 low.

Old findings of the area (15): 15 FIXED re-verified at the head, 0 STILL OPEN, 0 PARTIAL. SEC-8 is FIXED to the scope the owner chose
(Q1a); SA-02 records the two routes that scope left out.

## 2. Findings

### SA-01 (medium) - push approval collides with its own rate limit

**Where.** `routers/push_approval.py:42-43`: `PHONE_LIMITS = [(60.0, 30), (3600.0, 300)]` per user, key `paphone:<user>`. The same key
is charged by:
- `GET auth/step-up/push/{id}` (`:118`) - the REQUESTER's state poll; `sw-step-up-dialog.ts:17` polls it every `PUSH_POLL_MS = 2000`
  (30 calls a minute - exactly the minute cap on its own);
- `GET auth/push-approvals` (`:141`) - the PHONE's watcher; `shell/push-approval-watch.ts:10`, `:39-42` calls it every 5 s
  (`LOOK_MS`) for as long as the Android app is visible and the switch is on (12 a minute, 720 an hour);
- the phone's `challenge`, `approve` and `deny` (`_phone_request`, `:151`).

`RateLimiter.hit` refuses once any window is full and does not count the refused attempt (`services/ha_user_auth.py:624-625`), so a
client that keeps calling stays pinned at the cap. On the requesting screen `pollPush` (`sw-step-up-dialog.ts:322-343`) treats any
error, the 429 included, as the end: `this.push = null`, the error text is shown, polling stops. The API client does not retry 429
(`api/client.ts:284`).

**Scenario 1 (the approval itself).** Step-up and `security.push_approval` are on. A person on a desktop is asked to confirm a door
opening and picks "approve on my phone". The desktop polls every 2 s (30 hits in a minute); the phone's watcher call that finds the
request, the challenge and the approval add three more. Any approval that takes longer than about 50 s (the phone must be found,
unlocked, the app opened, the number typed, the biometric prompt answered - the request lives 90 s, `TTL_S`) meets a 429 on the
desktop's next poll: the dialog stops with "too many attempts" and drops the request id; the phone may then still approve it, which
is wasted (the approval is only spendable by the requester). If the app was already visible on the phone before the request, the
refusal comes earlier: the simulation above gives 38 s after the request opened.

**Scenario 2 (an app left open).** A phone that shows the Arx app for about 25 minutes inside an hour (a wall / kitchen phone, a
person watching cameras) fills the hourly window (300) with watcher calls alone (simulation: first refusal after 1,505 s); the watcher
keeps calling every 5 s, so the window stays full while the app is visible. Every requester state poll, challenge and approval of that
user is refused 429 for that time - push approval is unusable exactly for the users who keep the app open.

Fail-closed (nothing is approved by mistake), but the feature the owner asked for (CR-011 option D) breaks in ordinary use. The tests
cover the request limit only (`tests/test_mfa_t095_rest_2530.py::test_requests_are_rate_limited`), not the interplay of the polls.

**Fix.** Separate buckets: the requester's state poll on its own key (`pastate:<user>:<request id>`, e.g. 60 per minute - the id is
unguessable and the call is a memory read) and the phone's list poll on its own generous key, keeping the tight `paphone:` limit for
`challenge` / `approve` / `deny`. Poll the list more slowly when nothing is pending (15-30 s; the push notice already wakes the app).
On the requesting screen treat a `retryable` 429 as "wait and poll again" until the request's own `expires_in`. Add a test: phone
visible + requester polling for 80 s -> the approval is spent.

### SA-02 (low) - SEC-8 follow-up: two off-box routes still change where copies go / which keys decrypt, from the remote channel

**Where.** LOWS-BACKEND-2550 made target create / update / test and the key export local-only (`routers/backup_offbox.py:95-104`,
`:252`, `:270`, `:318`, `:446`). Not covered:
- `POST backups/offbox/targets/{id}/gdrive/connect` and `.../gdrive/poll` (`:371-403`) - the device-code consent connects whichever
  Google account approves the code shown on the screen; for an existing Google Drive target this is a change of the destination,
  the same thing `PUT targets/{id}` does for S3 / SFTP;
- `POST backups/offbox/key/import` (`:475-485`) - adds any well-formed key to the ring (`services/offbox_keys.py:160-179`; active only
  when the ring was empty), and `offbox_restore.prepare` decrypts a copy with ANY key of the ring (`services/offbox_restore.py:131`).

**Scenario.** With step-up off (the default) a stolen remote administrator session reconnects the Google Drive target to the
attacker's Google account; the next scheduled or remote-triggered push lands there. The copies are sealed with the active key, which
the attacker cannot export remotely, so this is not a disclosure by itself; with an imported attacker key the same session can place
a copy sealed with that key in the reconnected Drive and restore it from the remote channel (restore stays remote by the owner's
choice, Q1a). Low because the stolen-session attacker already holds `backup.manage` remotely (download of the plain project archive,
upload and restore of an archive - `routers/backup.py:183`, `:199`, `:211`), so the routes add consistency, not a new capability.

**Fix.** Apply `_local_only` to `gdrive/connect` (and `gdrive/poll`) when the target already has a connected account, and to
`key/import`; keep `gdrive/diagnose`, `gdrive/disconnect`, push, rotation and restore remote. Extend
`tests/test_lows_backend_2550_security.py::test_sec8_*` with the two routes.

## 3. Re-verification of old findings (area 1)

| Old id | Status at `57de3270c` | Evidence |
|---|---|---|
| SEC-1 (high) | FIXED (SEC-FIX-2520, in 2.52) | `services/step_up.py:713-716` `_refuse` recounts the wrong code after the rollback through `_recount_wrong_code` (`:732-748`: same `FAILURES` rule, a lockout already running is not re-counted). The new action-bound methods do not go through `_refuse` for a wrong secret: `routers/alarm.py:449-456` counts through `codes.LOCKOUT.fail` and answers an `ApiError` (commits); push approval failures count on the phone key (`dk.check`) |
| SEC-2 (medium) | FIXED (SEC-FIX-2520) | `services/device_key_attestation.py:10-11` and `services/device_attestation.py:140-153`: every certificate above the leaf must be a CA (BasicConstraints cA, keyCertSign when KeyUsage is present, pathLen kept), only the leaf may carry the KeyDescription |
| SEC-3 (medium) | FIXED (SEC-FIX-2520) | `services/backup.py:337-340` keeps `security.second_factor_policy`, `security.second_factor_bearer`, `remote.policy`, `remote.require_mfa_admin`, `remote.admins_default`, `remote.csp_enforce`, `security.local_*`; `:288` keeps the new `security.push_approval` and `security.step_up_alarm_pin`. Ratchet run above: no sign-in policy key outside the list |
| SEC-4 (medium) | FIXED (CORE-RELIABILITY-2540) | `services/app_session.py:207-225` uses `ha_user_auth.factor_owed` (`services/ha_user_auth.py:1125-1161`), the same rule as the remote sign-in (`second_factor_need`, `:1122`): code, active phone key under `required`, counting passkey (`passkey_sign_in.counts` checks the switch, `services/passkey_sign_in.py:73-82`), HA MFA through the family's `ha_mfa` = 1; `must_enroll` still refuses. Applied at exchange (`:299`) and redeem (`:439`). Test `tests/test_core_reliability_2540_app_factor.py` |
| SEC-5 (medium) | FIXED (CORE-RELIABILITY-2540) | `services/ha_user_auth.py:1566`, `:1580`: the IP and user limits are charged only when no session exists (`s is None`); `:1573-1578` an existing session is served through an HA outage and re-asked after `HA_BACKOFF_S`; `:1539-1540` serves it until then, never past the token's `exp`, never when rejected or revoked. Test `tests/test_core_reliability_2540_bearer.py` |
| SEC-6 (low) | FIXED (LOWS-BACKEND-2550) | `routers/media.py:450-461` runs `home_interface.enforce(..., method="GET")` in `_principal_for_ws._touch`; all 11 socket routes resolve their caller through `media._principal_for_ws` (checked: `access_control_ws`, `events`, `ha`, `intercom_listen`, `intercom_media` x2, `me`, `media` x2, `playback`, `wall`) |
| SEC-7 (low) | FIXED (LOWS-BACKEND-2550) | `services/local_identity.py:1230-1241`: one `UPDATE ... RETURNING failed_count` inside the write transaction, the window computed in SQL; `delay_until` set from the returned count in the same transaction |
| SEC-8 (low) | FIXED to the owner's scope (LOWS-BACKEND-2550, `0e179bdb6`) | `routers/backup_offbox.py:95-104` `_local_only` on create (`:252`), update (`:270`), test (`:318`), key export (`:446`); rotation, push and restore stay remote by decision Q1a. Gaps of the same kind: SA-02 |
| FC-02 (medium) | FIXED (FE-SAFETY-FIX-2520) | migration `0226_push_subscription_sign_in.sql` + `services/push.py:282-296`, `:344` (subscriptions bound to the sign-in and ended with it) |
| SCR-07 (medium) | FIXED (SCREENS-FIX-A-2520) | `routers/local_identity.py:451-485` self / last-administrator guard (409 `last_admin`, fail-closed when the check fails) |
| SCR-44 (low) | FIXED (LOWS-FRONTEND-2550, `4f5c19337`) | `components/sw-passkeys.ts` `cancelRow()` and `run()` drop the change waiting for its step-up |
| SCR-45 (low) | FIXED (`4f5c19337`) | `components/sw-user-factors.ts:105-117`, `sw-second-factor.ts`: the reset answer is painted only on the user it was sent for; Enter guard in since FE-SAFETY-FIX-2520 |
| SCR-47 (low) | FIXED (`4f5c19337`) | `screens/system-diagnostics.ts` backup panel follows `loadFailed.backup` |
| SCR-48 (low) | FIXED (`4f5c19337`) | `screens/system-audit.ts` (`Latest` read guard, export waits for a read in flight), `screens/audit-logic.ts:12-16` (cells starting with `= + - @`, tab, CR and the full-width forms neutralised), `:39-47` (installation zone) |
| SCR-49 (low) | FIXED (`4f5c19337`) | `screens/system-access.ts:653-659` danger confirmation naming role and scope; one's own binding warns and focuses cancel |

## 4. Improvements (short)

- **Push approval proves a permission, not a resource.** An approval for `door.open` (or `rbac.assign`) is good for one request of that
  permission on the requesting session - any door, any binding. The phone shows only "פתיחת דלת" (`sw-push-approval-sheet.ts` ACTION_TEXT).
  Binding the request to the resource the 403 named (door id, user id) and showing its name on the phone would make "what am I approving"
  true; worth it before push approval is switched on for physical actions.
- **Off-box rationale vs. plain backups.** The key export is local-only, but `GET backups/{name}/download` (project archive, sensitive part
  sealed or omitted) and upload + restore stay remote for `backup.manage`. If the owner's intent is "secrets and restores need the local
  network", the plain routes are the larger surface (owner decision; not a bug).
- **Tests that cannot see SA-01.** The push-approval tests drive one call at a time; one test with the two polls interleaved on the
  fake clock would have caught the shared bucket.
- **Audit screen zone default.** `system-audit.ts` shows `Asia/Jerusalem` until `productSettings()` answers; harmless here, but the same
  zone source as the other logs (one shared loader) would remove the second code path.

## 5. Checked and fine / not covered

### Checked and fine
- **Push approval service and routes** (`services/push_approval.py`, `routers/push_approval.py`, `wire/push_approval.py`): ids are 32
  random bytes, kept hashed; one open request per user (older ones superseded and audited); requester view bound to user AND session;
  the phone refused on the requesting session (`push_approval_same_session`) and never told the number; the number is inside the
  phone-key challenge's signed action text (`auth.push_approval.n<NN>`), a challenge of another request is spent and refused; signature
  checked (single use, session-bound, lockout) before the number; a wrong number DENIES and starts the 5-minute cooldown; approval only
  while pending and unexpired; spend is single use, same session, same action, within 60 s; the proof is `mark_action` (one request of
  that action, never a window); once-actions and own-factor changes excluded (`approvable`); switch default off and kept on restore;
  `/auth/` is on the home-interface allow-list, so home-only persons can use it for doors / alarm. Concurrency: every state change under
  `_LOCK`.
- **Step-up integration** (`services/step_up.py` +89): `methods_for` only on the gate of the action; `guard` consumes an action-bound
  mark only after the window check fails; `mark_action` refuses once-actions and factor changes; `alarm_pin` limited to disarm / bypass,
  same lockout key as the alarm screen, wrong codes committed with the 403.
- **UnifiedPush** (`services/unifiedpush.py`, `services/mobile_push.py`, migration 0227): SSRF fence = exact host (+port) allow-list from
  the add-on option, https only, no IP literals, no user info / fragment / control characters, netloc compared literally, redirects not
  followed, re-checked at send time; RFC 8291 + VAPID; endpoint never returned or logged; one route per device; endpoints cleared on
  unregister, revocation, `end_device_credentials` and VAPID rotation; 404 / 410 drop the endpoint; site-config errors do not count as
  device failures; the stats keys used exist (`config_errors`).
- **LAN listener hardening** (`services/lan_listener.py`): connection caps per total / address released in `finally`; the deadline
  reader bounds the whole request head (and the body where the handler does not clear it), raises `TimeoutError` past it.
- **Legacy import admin screen** (`components/sw-legacy-import.ts`) and route gate (`routers/legacy_migration.py:40-41`, `:85-95`):
  system administrator only, body read only after the gate (dependency order), apply needs the dry-run digest and the typed word,
  interactive session only, a pre-import backup; the screen keeps the dialog open while applying and shows a 409 as "run the check again".
- **Onboarding** (`api/onboarding.ts`, `routers/me.py` `onboarding.dismissed` as `StrictBool`): per-user preference only.
- **`/me/ws` hello** carries the add-on version (additive, signed-in users only).
- **`webauthn.py` internals** (first read): client data type / challenge (constant time) / exact origin / `crossOrigin` and `topOrigin`
  refused; rpIdHash compared in constant time; UP required, UV when asked; AT forbidden in assertions; trailing bytes refused; BS without
  BE refused; ES256 / RS256 only, algorithm must match the stored key; counter regression checked after the signature.
- `body_limit.py` (legacy import cap), `routers/bridge_key.py` (service-grant read uses the cached observation), `services/user_prefs.py`.

### Not covered (honest list)
- No test of the area was executed (PC lacks FastAPI; the runner was left to the 2.56 gate).
- `mobile/ios-shell`, `mobile/android-shell` (the plan says unchanged since 2.52; the push-approval contract was checked only from the
  web side: `deviceKeyBridge().sign(payload, text)`).
- `system-wizard.ts`, `system-cast.ts`, `system-storage.ts`, `system-onboarding.ts` beyond its API module, and most of the 96
  `system-*.ts` screens other than access, audit, diagnostics (backup panel) and the factor / passkey components.
- Authorization of routers outside this area, module by module (each area reviews its own; nothing seen outside the paths above).
- Frontend tests of the area were not sampled for assertion strength.
- The lab carry-overs stay open and untouched: what go2rtc sends for an `ffmpeg:` source (V-01) and the lab bridge key-store check before
  any re-pair (WB-02).
