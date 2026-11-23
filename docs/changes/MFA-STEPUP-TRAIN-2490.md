# MFA-STEPUP-TRAIN-2490 - the second-factor train: step-up before sensitive changes (slice 1: backend core)

Branch `pilot/MFA-STEPUP-2490`, cut from `origin/main` at `619f94d04` (v2.47.0). Task card `MFA-STEPUP-TRAIN-2490`
(`origin/chore/MGMT-OWNER-ANSWERS-2211:management/tasks.json`). No merge, no version bump, no changelog entry, no UI, no tag, no lab,
Home Assistant, NVR or go2rtc contact. Fakes only (the fake HA core of `tests/test_remote_access.py`).

Inputs read: `AGENTS.md`, `CLAUDE.md`, `MASTER_SPEC_HE.md` (silent on step-up), `docs/security/HA_IDENTITY_RBAC_HE.md` (silent on
step-up), `docs/security/FABLE_REVIEW_REPORT_2026-10-21.md`, `docs/changes/CR-011-SECOND-FACTOR.md`, the full design
`docs/design/full-2fa-t095/DESIGN.md` on `origin/pilot/FEATURE-DESIGNS-SEC-2490` (sections 1-14, with the owner decisions of
2026-11-22 in section 13), `private/planning/feature_designs_sec_2490_HE.md`, `private/planning/answers_2026-11-22_night.txt`, and the
code on `origin/main` (`auth.py`, `rbac.py`, `services/ha_user_auth.py`, `services/second_factor.py`, `services/local_identity.py`,
`services/local_passkeys.py`, `services/app_session.py`, `routers/second_factor.py`, `routers/bridge_key.py`, `routers/settings.py`,
`frontend/src/arx/webauthn.ts`).

## 1. Owner decisions this train implements (2026-11-22, Q44-Q53)

| Q | Decision |
|---|---|
| Q44 | Build after 2.49.0, as one train. |
| Q45 | Step-up (re-verify the second factor) before alarm disarm / zone bypass AND every change of settings, users and permissions. **Note:** a setting turns step-up off, so the second factor is asked only at the initial sign-in. |
| Q46 | 5 minutes of grace after one approval. |
| Q47 | Keep the authenticator code (TOTP) as one method next to passkeys. |
| Q48 | A long-lived token from outside stays ALLOWED while the rule is active (non-recommended; recorded risk). |
| Q49 | Recovery codes: 10 per user, single use. |
| Q50 | Passkeys for all users. |
| Q51 | In the app, password + phone key counts as two-factor. |
| Q52 | Phone hardware attestation: YES (non-recommended). |
| Q53 | Reset of auth methods from anywhere with admin approval (non-recommended; risk explained). |

## 2. Current state (origin/main @ 619f94d04)

Already shipped (design section 2, re-checked in the code for this note):

- **Arx TOTP** (K11, 2.2.0): `services/second_factor.py`, `routers/second_factor.py` - RFC 6238, AES-GCM secret, replay guard
  (`last_step`), 5 wrong / 5 min -> 10 min lock (persisted), per-user / per-role policy overrides, admin reset from any channel with
  the admin's own code. Asked at every NEW remote sign-in of an enrolled user (`X-Arx-Second-Factor`), also on a new bearer sign-in
  (`security.second_factor_bearer = enforce`). Ingress is never asked.
- **Passkeys** for Arx-only (local) users only (`services/local_passkeys.py`, own WebAuthn verifier `services/webauthn.py`, front end
  `frontend/src/arx/webauthn.ts`, `sw-passkeys`). `recent_auth()` (a factor-backed sign-in under 5 min) gates passkey management.
- **Ad-hoc step-up**, two places: `routers/second_factor.require_step_up` (admin reset; the admin's own code if the admin has one) and
  `routers/bridge_key.reveal_new_code` (mandatory own code, 403 `step_up_required` / `step_up_unavailable`).
- Not in the code before this slice: any generic step-up gate, `auth/step-up/*`, `security.step_up*`, a proof window, sign-in
  provenance, recovery codes, device keys.

## 3. What slice 1 adds (backend core of step-up)

### 3.1 One central gate

`services/step_up.py`. `rbac.require()` calls `step_up.on_grant(conn, principal, permission)` after it ALLOWED a permission. When

1. the permission is in `GATED_PERMISSIONS` - settings: `system.configure`, `sources.configure`, `nvr.configure`,
   `site.content.configure`, `calendar.configure`, `tickets.configure`, `backup.manage`, `system.update`, `bridge.key.rotate`,
   `partner.manage`; users: `identity.local.manage`, `users.ha_manage`; permissions: `rbac.assign`, `rbac.roles.manage`;
2. the connection belongs to an HTTP request (`auth._track` links the request's own connection, get_conn / get_read_conn; it is
   unlinked before the connection goes back to the pool) and the method is not GET / HEAD / OPTIONS;
3. the route is not one of `EXEMPT_ROUTES` (the two routes that already demand their own code on every call),

then `step_up.guard()` runs: it passes when step-up does not apply (3.3) or the caller's session holds a fresh proof; otherwise it
rolls back what the request wrote so far (an `ApiError` commits, so nothing half-written may stay), audits `auth.step_up.required`
(denied; permission, method, route template - never an id) and answers **403 `step_up_required`** with
`details = {action, methods, minutes, verify_path}`. A request passes the gate once (`request.state.sw_step_up`), however many
`require()` calls it makes. Every current and future write route that authorises a gated permission with `require()` is covered with
no per-route code; `guard()` is public for a route that authorises without `require()` (none wired in this slice, see 6.2).

### 3.2 Proofs ("marks"): server-side, per session, 5-minute grace

In memory (like the remote session store), keyed by a SHA-256 of the session's sign-in (`RemoteSession.sign_in()` = the HA sign-in,
`LocalSession.sign_in()` = the local chain, `AppWebSession.sign_in()` = the app session; `ingress:<user>` on the local channel) and
bound to the user id. Never on the HA token, never in a client cookie. A restart forgets them (the user is asked again). A proof
counts for `security.step_up_minutes` (default 5); with 0 a verified proof is good for ONE gated request within 60 s.

Sources of a proof:

- `POST /api/v1/auth/step-up/verify {method: "totp", code, action?}` - the current authenticator code (`second_factor.verify`: replay
  guard and lockout shared with sign-in). Rate-limited per user (10 / 5 min, 30 / h). Audited `auth.step_up.ok` (allowed; method,
  action, minutes) or `auth.step_up.failed` (denied; reason `step_up_invalid` / `step_up_locked` / `step_up_unreadable`). Never the code.
  409 `step_up_no_method` / `step_up_not_applicable {reason}` / `step_up_no_session`.
- a remote sign-in that just showed the code (`ha_user_auth.exchange`, `factor == "code"`): the session starts with a fresh proof;
- the enrolment's first code (`POST auth/second-factor/confirm`) in this session;
- an Arx-only session whose sign-in showed the factor (`auth_local_sessions.factor_at`, kept across rotations) within the window.

A user's proofs are dropped when their factor is removed (`disable`) or reset by an administrator.

`GET /api/v1/auth/step-up` answers `{enabled, minutes, local_channel, applies, reason, methods, valid_until}` for the next slice's UI.

### 3.3 When step-up does not apply (`not_applicable`)

| Reason | Rule | Source |
|---|---|---|
| `off` | `security.step_up = off`: only the sign-in factor (the owner's off switch) | owner note on Q45/Q46 |
| `local_channel` | the request came through Ingress and `security.step_up_local = off` (default) | CR-011 E ("remote channel by default"); design 4.2 |
| `bearer_token` | a remote caller authenticated by an HA access token on every request (no Arx session) | owner Q48 (long-lived tokens stay allowed) |
| `no_method` | the user has no step-up method (no authenticator code enrolled) - today's behaviour kept | security docs silent -> open question 7.1 |

### 3.4 Settings (`services/settings_store.DEFAULTS`, `PATCH /settings`, never restored from a backup)

| Key | Values | Default |
|---|---|---|
| `security.step_up` | `on` \| `off` | `on` (the lead's instruction; see contradiction 5.1) |
| `security.step_up_minutes` | 0-30 (int) | 5 |
| `security.step_up_local` | `on` \| `off` | `off` |

Changing them needs `system.configure` and therefore, while step-up is on, a fresh proof (switching it off is itself a gated change);
the generic `settings.update` audit row records the change. All three are in `backup.SETTINGS_KEEP` (a restore never weakens them).

### 3.5 Files

`smplwise/services/step_up.py` (new), `smplwise/rbac.py` (hook in `require`), `smplwise/auth.py` (link / unlink the request's
connection), `smplwise/services/ha_user_auth.py` (sign-in proof), `smplwise/routers/second_factor.py` (status + verify routes, enrolment
proof, proofs dropped on disable / reset), `smplwise/wire/second_factor.py` (`StepUpStatus`, `StepUpProof`),
`smplwise/routers/settings.py`, `smplwise/services/settings_store.py`, `smplwise/services/backup.py`,
`frontend/src/api/generated/wire-second-factor.ts` (regenerated), `contracts/API_INVENTORY.md` (regenerated),
`tests/test_mfa_stepup_2490.py` (new).

## 4. Train plan (slices, each with its tests)

Built on design section 12/14; every slice is one agent row, ships behind the switches, and adds a regression test for what it fixes.

| # | Slice | Content | Tests | Depends |
|---|---|---|---|---|
| 1 | **STEPUP-CORE** (this branch) | central gate on settings / users / permissions writes, server-side proofs with the window, off switch, local-channel switch, TOTP verify, status route, audit rows | `tests/test_mfa_stepup_2490.py` (required, within grace, expired, window setting, 0 = one change, sign-in proof, session + user binding, wrong code / lockout audited, off switch, bearer exemption, no-method, local channel, exempt routes, factor reset drops proofs, rollback before refusal, defaults / restore keep) | - |
| 2 | **STEPUP-UI** | `src/api/step-up.ts`, client interceptor for 403 `step_up_required` (sheet, verify, retry ONCE with the same request id, never a blind physical retry), `sw-step-up-sheet` (code entry; desktop + phone, light + dark, RTL, he/en), settings toggles under Users & permissions › second factor, before/after compare page | Playwright mocked: sheet per state, retry once and never twice, cancel = no retry, settings toggles; pixel baselines on the runner; axe | 1 |
| 3 | **STEPUP-GATES** | alarm disarm / zone bypass (owner Q45), door unlock and alarm codes per `security.step_up_scope`; move the two ad-hoc checks (admin factor reset, bridge-key reveal) onto the central proof as once-actions (fresh, action-bound); route-table ratchet: every write route that authorises a gated permission (also through `authorize()` or a delegated path) is gated or listed with a reason; the alarm-PIN fallback for alarm actions | route-table ratchet test; per-route 403 / pass tests; alarm PIN only on alarm actions; no queued / retried physical command | 1 |
| 4 | **PASSKEYS-ALL** | passkeys for every user (Q50) behind `security.passkeys_all_users`; `POST auth/step-up/challenge` (32-byte nonce, 60 s, single use, bound to user + session + action); passkey as a step-up method and as the sign-in factor of HA users; rpId change handling | challenge binding (other user / session / action, expired, reused); assertion via `tests/webauthn_fake.py`; counter regression | 1 |
| 5 | **POLICY + PROVENANCE** | `security.factor_policy` (+ `exempt`, wall users), HA MFA provenance (`auth_mfa_seen`, `auth/refresh_tokens`), compliance view; `security.remote_long_lived_tokens` stays `allow` (Q48) | policy matrix; fake `auth/refresh_tokens` shapes (normal / long-lived / other client / older than MFA seen / drift) | - |
| 6 | **TOKENS** (Q48 mitigation) | per-user long-lived-token list, revoke / revoke-all, first-use-from-outside audit + owner notice, optional `security.remote_token_max_days`; then narrow the slice-1 bearer exemption to long-lived tokens only | token list / revoke / notice tests; a short-lived bearer is gated, a long-lived one is not | 5 |
| 7 | **RECOVERY** | 10 single-use codes per user (Q49), scrypt, shown once, regenerate = once-action step-up, use forces re-enrolment, never a step-up method | generate / use / regenerate / void; never satisfies step-up | 5 |
| 8 | **DEVICEKEY-SRV + APP** | `auth_device_keys`, register / verify / revoke; Android Keystore EC P-256 + BiometricPrompt + CryptoObject (`biometric_or_screen_lock`, owner q23 b); in the app password + phone key = two-factor (Q51) | generated P-256 key signatures; app instrumented on a real phone (owner present) | 1 |
| 9 | **DEVICEKEY-ATTEST** (Q52) | attestation challenge, offline chain check against pinned Google roots, `attested` column, `security.device_key_attestation` off / preferred / required with fallback | chain fixtures (hardware / software / none / broken root list) | 8 |
| 10 | **RESET-HARDENING** (Q53) | admin reset from anywhere with a fresh once-action step-up, typed confirm, 3 / admin / hour, notices, revoke-all, forced re-enrolment | reset rules (self, last admin, channel setting, rate limit) | 3, 7 |
| 11 | **SCREENS** | account security page, admin policy tab with the compliance preview, user-drawer factors section, sign-in methods chooser (+ recovery code) | Playwright + baselines + axe | 5, 7 |
| 12 | **REVIEW-DOCS** | deep security review of gates / enrolment / recovery, DOCS.md + DOCS_HE.md, bilingual notes | review report | all |

## 5. Contradictions found (recorded, not resolved silently)

1. **Default of the step-up switch.** The lead's instruction for this slice says default ON (= step-up required), consistent with the
   owner's Q45 decision ("before every change") and his note (a setting to turn it OFF). The design `docs/design/full-2fa-t095/DESIGN.md`
   (sections 4.2, 6, 11, 14) says `security.step_up` defaults to `off` and "everything ships with every switch off = today's
   behaviour" (written under the 07.11 "MFA later" constraint, which Q44 superseded). **Implemented: ON**, per the lead. Effect today:
   only remote users who enrolled the authenticator code are asked (3.3), but **no UI exists until slice 2**: a remote enrolled
   administrator would get 403 `step_up_required` on every settings / users / permissions change after the grace. This branch must not
   ship without slice 2 (or the default must be flipped for the release that carries slice 1 alone). Open question 7.2.
2. **Channel scope.** CR-011 E and design 4.2 put step-up on the remote channel by default (`security.step_up_local = off`); the owner's
   Q45 says "every change". Implemented: remote by default, Ingress on by the setting. Open question 7.3.
3. **Bearer vs long-lived token.** Q48 allows long-lived tokens. Without the provenance check (slice 5) a long-lived token cannot be told
   from a short-lived HA access token on the bearer path, so slice 1 exempts every bearer caller. Slice 6 narrows it. Open question 7.4.
4. **Challenge / verify shape.** Design 4.2 / 7 has `POST auth/step-up/challenge` + `verify {challenge_id, ...}` with action binding.
   The TOTP code needs no server nonce, so slice 1 has `verify` only; the challenge arrives with passkeys (slice 4). Not a conflict with
   the security docs; noted so the UI slice codes against `verify` with an optional `challenge_id` later.
5. **CR-011 status line** still says "Proposed - design record, no product code" although the TOTP factor, passkeys and two ad-hoc
   step-ups shipped (already recorded in design 2.2 / 2.6; the TOTP contradiction itself was closed by Q47). CR-011 is not edited here.
6. **The two ad-hoc step-ups** ask for a code on every call; the central proof asks once per 5 minutes. To keep both behaviours unchanged
   in slice 1 their routes are `EXEMPT_ROUTES` (their own check is stricter). Design 4.2 makes them once-actions on the central proof
   (slice 3). Also note: a code used for `verify` cannot be reused for those routes within the same 30-s step (the replay guard).

## 6. Limits of slice 1 (known, not hidden)

1. Only the authenticator code is a step-up method. A user with a passkey but no TOTP (a local user) counts as `no_method` and is not
   gated (their factor-backed local sign-in still counts as a proof when they do have TOTP).
2. Routes that authorise a gated permission through `authorize()` instead of `require()` are not gated by the hook. Found in this read:
   the delegated-assigner branch of `DELETE /access/bindings/{id}` (`assigns_anywhere` skips `require`), `rbac_admin.scope_in_reach`,
   and capability-style branches (`devices`, `exports`, `playback`, `door_automation`, ...). Slice 3 adds the ratchet and wires
   `step_up.guard()` where a change is authorised without `require()`.
3. Handlers that open their own connection (`principal_light` routers, `db.connection()` inside a handler) are not linked, so a
   `require()` on such a connection is not gated (none of the settings / users / permissions writes found does this).
4. POST routes that only read (previews, checks: `POST /access/roles/preview`, `POST /ha-users/check`) are gated like any write -
   asking once per 5 minutes; slice 3 may list them as exempt.
5. Proofs and the link table live in memory: one process (as the remote session store). A restart asks again.
6. On the local channel (only when `security.step_up_local = on`) Ingress carries no Arx session, so a proof there is per user
   (`ingress:<user>`), shared by that user's Ingress tabs - weaker than the per-sign-in proof of the remote channel.

## 7. Open questions (recommendation first)

1. **A user with no second factor at all (no TOTP, no passkey) changes settings remotely while step-up is on.** The security docs are
   silent; slice 1 keeps today's behaviour (allowed, no row). (a) keep allowed until the sign-in policy (slice 5) forces enrolment
   [recommended: the policy layer is where "must have a factor" belongs, and it is per user / role]; (b) refuse with
   `step_up_unavailable` (like the bridge-key reveal) for administrators only; (c) refuse for everyone.
2. **Default ON before the UI exists.** (a) keep ON and merge slices 1 + 2 together into the train (never release slice 1 alone)
   [recommended]; (b) ship slice 1 with default OFF and flip to ON with slice 2.
3. **Local channel (Ingress).** (a) keep `security.step_up_local = off` by default - the local network stays the break-glass path
   [recommended, CR-011 E / design 4.2]; (b) default ON (every change everywhere, as Q45 reads literally).
4. **Bearer callers.** (a) exempt every bearer caller now, narrow to long-lived tokens in slice 6 [recommended]; (b) gate short-lived
   bearer tokens already now with an inline code header.
5. **Which module permissions count as "settings".** Slice 1 gates `*.configure` of system, sources, NVR, site content, calendar and
   tickets plus backup / update / bridge key / partner. Not gated: `notify.manage`, `messaging.accounts.manage`, `automation.manage`,
   `rules.manage`, `access.groups.manage`, `access.schedules.manage`. (a) keep the list and let the owner extend it [recommended];
   (b) add the operational management permissions too.
6. **Who may switch step-up off.** (a) anyone with `system.configure`, after a step-up, audited [recommended, design 4.2];
   (b) a system administrator only, from the local channel only.

## 8. Tests (real runs)

| Where | Command | Result |
|---|---|---|
| workstation (Windows, Python 3.12) | `pytest tests/test_mfa_stepup_2490.py` | 22 passed |
| workstation | `pytest` on `test_second_factor.py`, `test_second_factor_followups.py`, `test_security_review_220.py`, `test_wxh4_emergency_revoke_2407.py`, `test_singletons_registered.py`, one file at a time | no FAILED / ERROR line (run with `-qq`, so no pass counts printed) |
| workstation | `npx tsc --noEmit -p frontend` (after `scripts/gen_wire_types.py`) | exit 0 |
| runner slot B, `5027f0fbf` | 102 backend files matching step / second_factor / remote / local_identity / local_passkeys / settings / rbac / access_(bindings, roles, custom, directory, groups) / backup / identity / wire / bridge_key / ha_users / security / singletons / app_session / t06_admission / db_gate / raw_body / guard, 5 chunks (`-o addopts=""`, junit per chunk, `~/work/mfastep-out`) | **2467 passed, 4 skipped, 3 xfailed, 0 failed** (632 + 819/4s + 583 + 395/3xf + 38) |
| runner | `ruff check smplwise` (pyflakes lane) | All checks passed |

NOT_RUN: the full backend suite (the release gate's slot A only), every Playwright / pixel suite (no UI in this slice), any lab check.
