# MFA-RESET-CHANNEL-UI-2520 - the reset channel on the second-factor tab, the step-up dialog wording, a passkey as the "enrol first" enrolment

Branch `pilot/MFA-RESET-CHANNEL-UI-2520`, cut from `origin/release/2520-train` = `ea04ad4fd` (it carries MFA-REVIEW-DOCS-2520 and
MFA-HA-PASSKEY-2520). Target 2.52. No version bump, no changelog entry, no tag, no lab / Home Assistant / NVR / go2rtc contact, no change
to home-system users, groups or admin flags. Fakes only: the fake Home Assistant core of `tests/test_remote_access.py`, the software
authenticator `tests/webauthn_fake.py`, mocked endpoints and a Chromium virtual authenticator on `localhost`.

Spec (lead, from `docs/security/MFA-REVIEW-2520.md` N-7 and `docs/changes/MFA-HA-PASSKEY-2520.md` open question 4; owner rule
unanswered = recommendation):

1. N-7: `security.factor_reset_channel` gets a screen on Settings > Users & permissions > Second factor; same permission / audit as the
   other sign-in policy keys; default unchanged.
2. Step-up dialog wording: "a passkey or the code" when the user has a passkey that counts.
3. A user told "enrol first" (factor policy required) may register a passkey as that enrolment while `security.passkey_remote_factor` is
   on, keeping the fresh-sign-in-within-5-minutes rule of adding factors.

## 1. What changed

### 1.1 N-7 - the reset channel row (frontend only)

`components/sw-factor-policy-admin.ts`: one more row at the end of the sign-in policy card - "איפוס דרכי אימות של משתמשים" /
"Resetting users' sign-in methods", a two-key `sw-segmented` ("מכל מקום" / "Anywhere" = `any`, "רק מהרשת המקומית" / "Local network only"
= `local`), saved with the tab's one save row (`PATCH /settings`). The hint line states the server's rule ("back to Anywhere only from the
local network").

* Default unchanged: `any` (the server's DEFAULTS; the screen's fallback when the key is missing is `any` too).
* Permission and audit: unchanged and the server's - `routers/settings_patch/identity.factor_reset_channel` (MFA-RESET-HARDENING-2510):
  system.configure + **system administrator only**, every attempt audited `security.factor_reset_channel` (allowed / denied), widening
  to `any` refused from outside (403 `local_only`, audited). This is stricter than the other sign-in policy keys (system.configure,
  audited `settings.update`); the row keeps the stricter rule rather than loosening it (no authority widening - see open question 1).
* What the screen shows of those rules: read-only without system.configure (like every row of the tab); disabled with the line "רק מנהל
  מערכת משנה את ההגדרה הזו." for a holder of system.configure who is not a system administrator (computed from `/me` bindings exactly as
  `rbac.is_system_admin`: an installation-wide `system_admin` allow-binding, no installation-wide deny, never an Arx-only identity - a
  hint only, the server checks again); on the remote channel while `local` is stored, the `Anywhere` key is disabled with the line
  "החזרה ל״מכל מקום״ אפשרית רק מהרשת המקומית." (narrowing to `local` stays possible from anywhere).
* No backend change for this part. No new style, colour or size.

### 1.2 The step-up dialog

Found at the base: the dialog ALREADY says "a passkey or the code" (`stepUp.bodyBoth`, MFA-TRAIN-2500) whenever the server lists
`passkey` among the methods (= the user's passkey counts, `step_up.methods_of`) and the browser can use passkeys. Two real gaps remained
and are closed:

* A passkey that counts in a browser WITHOUT passkeys: the passkey was silently left out (the text said "enter the code" only). Now a hint
  under the text: "למפתח הגישה שלך צריך דפדפן שתומך במפתחות גישה. כאן אפשר לאשר בדרך אחרת." (`data-step-up-passkey-elsewhere`).
* At another address than the passkey's (the local network's address, with `security.step_up_local` on): the button ran a ceremony the
  browser must refuse and the dialog said "cancelled, or no matching passkey". Now `api/step-up-passkey.passkeyStepUp` checks the
  challenge's RP id against the page's host first (`arx/webauthn.rpIdFits`) and throws `PasskeyWrongHost`, shown as the existing
  "מפתחות גישה פועלים רק בכתובת {origin}" (`local-identity.passkeyWrongHost`); the code field stays. `PasskeyWrongHost` extends
  `PasskeyCancelled`, so other callers keep their behaviour; `sw-passkeys` shows the same line.

### 1.3 A passkey as the "enrol first" enrolment (backend + sign-in page)

Why it needs the sign-in itself: a passkey works only at the configured public address (the RP), and a home-system user answered
"enrol first" (403 `second_factor_enrollment_required`) gets no remote session at that address to open My Account in; the local channel
(Ingress) is another origin. So the enrolment rides on the browser exchange, in the pattern MFA-HA-PASSKEY-2520 set for the passkey
sign-in step.

* New `services/passkey_sign_in_enrol.py` (docstring = the full rules). Only while `security.passkey_remote_factor` = on (default off).
  The 403's `details` gain `passkey_enrol` = `{origin, user_verification_required, publicKey: creation options}` (resident key; user
  verification `required` for an administrative user, else `preferred`; the user's existing passkeys excluded). The answer:
  `X-Arx-Second-Factor: pkr1:<rawId>.<clientDataJSON>.<attestationObject>[.<transports>]` (at most 8000 characters), verified by
  `webauthn.verify_registration` against the configured origin / RP id, stored by `user_passkeys.store` (audited
  `auth.passkey.registered` with `step: sign_in_enrol`, the user notified on every device, other sign-ins / phone device tokens ended as
  after any first factor, an administrator's `must_enroll` ended). The new passkey counts, so the sign-in completes and starts with a
  fresh step-up proof (`step_up.note_sign_in_factor`), audited `auth.remote_session.created` with `second_factor: passkey_enrol`.
* **The fresh-sign-in rule** (SR-3 / MFA-FACTOR-HARDEN-2520 for every factor added from outside): the Home Assistant access token must
  have been issued within `step_up.RECENT_SIGN_IN_S` (its `iat`, 5 minutes, at most one minute of clock skew; no `iat` = not fresh);
  the challenge (60 s, single use, one open per user, the `remote_factor` pool with its own binding) is bound to the user AND to that Home
  Assistant sign-in (hash of the token's refresh-token id). An older token gets no offer (the refusal of before); a late answer is refused
  (`enrol_not_offered`). The session-based helper of MFA-FACTOR-HARDEN-2520 (`step_up.require_recent_sign_in`) cannot be reused here:
  no Arx session exists yet - the token's own issue time is the equivalent.
* Both "enrol first" paths: the per-user / per-role / legacy `admins` policy (`second_factor_need` -> `enroll`) and the enforced global
  policy when the home system reports no MFA (`provenance_gate` -> `no_ha_mfa` or another non-"sign in again" verdict).
* Never offered (the 403 of before, byte-identical): the switch off (an enrolment answer is then not even read); `security.passkeys_all_users`
  off; no public address; an Arx-only identity; the bearer path (native clients); the passkey limit; a token older than 5 minutes; **an
  administrator's reset pending** (`must_enroll`, `FACTOR_ENROLL_AFTER_RESET` - a reset often follows a suspected compromise; open
  question 2); the provenance verdict `before_mfa_seen` ("sign in again").
* Refusals: 401 `second_factor_invalid` (the page keeps the step), audited `auth.second_factor.failed` with method `passkey` and `why` =
  `enrol_<reason>`; a failed store rolls back. No audit row carries a credential id, a public key, a challenge, an attestation or the answer.
* `services/user_passkeys.py`: the storing half of `register` is extracted unchanged into `store()` (shared by both callers); `register`
  keeps its checks and `note_proof`.
* `services/ha_user_auth.py`: `exchange` calls `_passkey_enrolment` on the two "enrol first" paths; `_enrolment_gate` picks the provenance
  refusals that are enrolments. The audit row of the refusal is the same as before (plus `passkey_enrol: offered` when an offer went out).
* Frontend: `arx/auth.ts` keeps the pending sign-in when the 403 carries an offer (`hasPendingEnrolment`, `pendingEnrolOrigin`,
  `completeEnrolmentPasskey` - renews a stale offer by asking again without an answer, as the passkey sign-in step does); without an offer
  the refusal ends the sign-in and the home-system sign-in is revoked, as before. `arx/arx-login.ts`: a new step `henrol` - the existing
  passkey block (no new style): "הוספת מפתח גישה וכניסה" / "Add a passkey and sign in", the wrong-address / no-passkeys lines of before,
  the other way ("אפשר גם להפעיל אפליקציית אימות ב״החשבון שלי״ בכניסה מהרשת המקומית.") and Back.

### 1.4 Files

Backend: `smplwise/services/passkey_sign_in_enrol.py` (new), `services/ha_user_auth.py`, `services/user_passkeys.py`,
`tests/test_mfa_reset_channel_ui_2520.py` (new). Frontend: `components/sw-factor-policy-admin.ts`, `components/sw-step-up-dialog.ts`,
`components/sw-passkeys.ts` (one line), `api/step-up-passkey.ts`, `arx/webauthn.ts`, `arx/auth.ts`, `arx/arx-login.ts`,
`i18n/lang/en/i18n/msg/mfa.ts`, `tests/evidence-mfa-reset-channel-ui-2520.spec.ts` (new), `tests/unit-mfa-reset-channel-ui-2520.spec.ts`
(new), refreshed pixel baselines of `tests/pixel-mfa-screens-2510.spec.ts-snapshots/` (section 2). No route, wire type, migration, setting
key or API inventory change. Files of the 2.52 train rows (WisKey R1-R8, bridge, DESIGN-LITERALS-2510): none touched.

### 1.5 Overlaps with MFA-FACTOR-HARDEN-2520 (running in parallel)

* `services/user_passkeys.py`: that row edits `registration_options` (lines ~178-185); this row extracts `store()` out of `register`
  (lines ~203-270). Separate hunks - a clean textual merge is expected; after the merge `register` still calls `store`.
* `services/step_up.py`, `routers/local_passkeys.py`, `routers/second_factor.py`, `routers/device_keys.py`, `factor-reset-confirm.ts`,
  `sw-second-factor.ts`, `he.ts` / `en.ts`: not touched here.
* `frontend/src/i18n/lang/en/i18n/msg/mfa.ts`: both rows append lines (that row one line in the reset block, this row a block at the
  end) - a possible adjacent-line conflict at the end of the object, trivially resolved by keeping both.
* The fresh-sign-in rule: FACTOR-HARDEN's `require_recent_sign_in(request, action)` is session-based; the enrolment here happens before
  any session exists, so the same 5-minute rule is applied to the Home Assistant token's issue time (`passkey_sign_in_enrol.token_fresh`).

## 2. Tests (real runs)

| Where | Command | Result |
|---|---|---|
| workstation (Windows, repo venv, `SW_WIRE_STRICT=1`) | `pytest tests/test_mfa_reset_channel_ui_2520.py` (10 tests: off = unchanged and an enrolment answer not read; on = offer + enrolment + sign-in + fresh step-up proof + the passkey asked next time; administrator UV; bound to the sign-in / single use / origin / RP id / UP / wrong ceremony type / malformed; the 5-minute rule; the enforced global policy path; no offer after a reset / all-users off / no address / bearer; answer format; audit hygiene; the reset channel setting) | **10 passed** (exit 0) |
| workstation | `ruff check` the three changed backend files; esbuild syntax pass of the 10 changed / new TS files | All checks passed; 10 ok |
| runner slot B, job `~/work/p2520_resetui_run.sh` at `439b0a1c6` | backend shard 0: this row + `test_mfa_ha_passkey_2520`, `test_mfa_passkeys_2490`, `test_local_passkeys`, `test_passkey_only` | **134 passed** |
| runner | shard 1: `test_second_factor`, `test_second_factor_followups`, `test_mfa_policy_2490`, `test_mfa_screens_2510`, `test_settings_patch_audit_order` | **117 passed** |
| runner | shard 2: `test_remote_access`, `test_security_review_220`, `test_mfa_devicekey_2490`, `test_mfa_recovery_codes_2490` | **143 passed** |
| runner | shard 3: `test_mfa_stepup_2490`, `test_mfa_stepup_gates_2490`, `test_mfa_secfix_2500`, `test_mfa_secreview_2500`, `test_mfa_reset_hardening_2510`, `test_mfa_review_docs_2520`, `test_mfa_tokens_2490` | **113 passed** |
| runner | shard 4: `test_app_session_295`, `test_ha_authority`, route tables, read-conn, wire D, route characterisation | **979 passed** |
| runner | ruff `smplwise` / `gen_wire_types.py --check` / `design_ratchet.py` | rc 0 / rc 0 / rc 0 (no count above baseline) |
| runner | `tsc --noEmit -p .` | 0 errors |
| runner | `tsc -p tsconfig.tests.json` | 1 error at `439b0a1c6` (an unused parameter in this row's unit spec) - fixed in `d6305bc9d`; **0 errors** in job 2 |
| runner | eslint (the 8 changed src files), lazy-tags-check, `i18n-split-langs --dry`, `npm run build` | all rc 0 |
| runner | `unused-exports --enforce` | **rc 1**: 9 NEW entries, all in WisKey files of the train base (`access-control/status-wiskey-logic.ts`, `api/wiskey-system-status.ts`, `api/station-ops.ts`, `screens/wiskey-relay-map-logic.ts`) - none in a file this row touches; not re-run on the bare base to confirm (NOT_RUN) |
| runner | Playwright evidence (preview build): this row + `evidence-mfa-ha-passkey-2520` + `evidence-mfa-screens-2510`, desktop + mobile | 44 passed, 4 failed, 4 skipped at `439b0a1c6`: the 4 failures were this row's two dialog tests that need a browser with WebAuthn, on an IP preview (not a secure context) - the spec now presents WebAuthn to the page (`d6305bc9d`) |
| runner, job 2 `~/work/p2520_resetui_run2.sh` at `02cbcc301` | this row's evidence spec, desktop + mobile | **18 passed** |
| runner | `pixel-mfa-screens-2510` `--update-snapshots=changed`, then re-check | 6 passed / 6 passed; ONE baseline rewritten: `mfa-policy-preview-1440-desktop-linux.png` (the new row; the phone baseline is unchanged - the row is below its fold). Looked at. Committed in `02cbcc301`. |
| runner | unit pages on `localhost` (WebAuthn RP id): this row (incl. the full enrolment ceremony with a CDP virtual authenticator and a cancelled ceremony), `unit-mfa-ha-passkey-2520`, `unit-mfa-signin-methods-2510`, `unit-mfa-passkeys-2490`, `unit-mfa-recovery-codes-2490` | **19 passed**, 7 skipped (not itemised; the shots tests skip without `SW_SHOTS_DIR`) |
| runner | compare pictures after / before (policy card + row, the remote state, the dialog, the sign-in enrolment step; desktop + phone, light + dark) | written; the "before" runs fail by design after their picture (the row does not exist on the base) |

Compare page: `private/planning/mfa-reset-channel-ui-2520_compare_2026-11-25.html` (local, Hebrew).

NOT_RUN: the full backend suite (only the five shards above), the full Playwright suite, any real device (Chrome / Android / iOS passkeys
at the lab address), any lab check, the phone app's web view.

Merge trial (`git merge-tree` against `origin/pilot/MFA-FACTOR-HARDEN-2520` at `d4986953a`): `services/user_passkeys.py` merges
automatically; ONE conflict - the end of `frontend/src/i18n/lang/en/i18n/msg/mfa.ts` (both rows append lines): keep both blocks.

## 3. Open questions (recommendation first)

1. **Who may change the reset channel.** The spec said "same permission/audit as the other sign-in policy keys" (system.configure,
   `settings.update`); the server already requires a system administrator with its own audit row (MFA-RESET-HARDENING-2510). (a) keep the
   stricter server rule; the screen shows it [recommended - loosening would widen who can strip factors]; (b) loosen to system.configure.
2. **Passkey enrolment after an administrator's reset** (`must_enroll`). (a) not offered - that user enrols through the local channel as
   before [recommended: a reset often follows a suspected compromise, and a stolen password must not re-enrol]; (b) offered like any
   "enrol first".
3. **Trust on first use.** With the switch on, a user who must enrol and has no factor can be enrolled by whoever holds the password at
   that moment (inside 5 minutes of a real home-system sign-in; the user is notified on every device; audited). This is inherent in any
   remote enrolment. (a) accept, tied to `security.passkey_remote_factor` as the spec says [recommended]; (b) a separate switch
   `security.passkey_remote_enrol` (default off) so turning on the passkey sign-in factor does not also open remote enrolment.
4. **The reset channel row's place.** (a) the last row of the sign-in policy card [recommended: no new card, no scrolling]; (b) a small
   card of its own under the step-up card.
