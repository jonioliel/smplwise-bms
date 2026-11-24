# MFA-SECFIX-2500 - the second-factor train brought together, and the security review fixed

Branch `pilot/MFA-TRAIN-2500` (worked in `C:\cloude\smplwise-mfasecfix` on the local name `work/MFA-SECFIX-2500`, pushed to
`pilot/MFA-TRAIN-2500`), from the train head `6f40529bb` (slices 1, 2, 4, 6). Inputs: `docs/changes/MFA-SECREVIEW-2500.md`
(`origin/pilot/MFA-SECREVIEW-2500`, findings SR-1..SR-7, watch items W-1..W-3, its xfail tests), `docs/changes/MFA-TRAIN-2500.md`,
each slice's change note (`MFA-STEPUP-GATES-2490`, `MFA-RECOVERY-CODES-2490`, `MFA-POLICY-2490`, `MFA-DEVICEKEY-2490`,
`MFA-DEVICEKEY-ATTEST-2490`), `docs/security/HA_IDENTITY_RBAC_HE.md`. No version bump, no changelog entry, no tag, no lab / Home
Assistant / NVR / go2rtc contact.

## 1. Merges (`--no-ff`, in this order)

| # | Merge commit | Branch (head) | Textual conflicts | Resolution |
|---|---|---|---|---|
| 1 | `38cca1640` | `origin/pilot/MFA-STEPUP-GATES-2490` (slice 3, `a82424879`) | `routers/second_factor.step_up_verify` | the passkey branch (slice 4) first; the code path takes slice 3's once-actions and slice 4's factor actions together (a proof whatever the switch / channel says; only `no_method` refuses) |
| 2 | `169f7fc4c` | `origin/pilot/MFA-RECOVERY-2490` (slice 7, `affa63886`) | `routers/second_factor.py` (docstring, `StepUpBody`, verify tail), `services/step_up.py` (constants, `fresh_proof`), `wire/second_factor.py`, `api/second-factor.ts`, generated files | both sides kept; `StepUpBody` keeps the passkey fields with an optional code; slice 7's placeholder refusal of `passkey` dropped (slice 4 answers it); `fresh_proof` keeps slice 4's `local_sign_in` keyword; **W-1 at merge**: a recovery code is refused before it is read for a once-action (below, section 2) |
| 3 | `cee57b0f9` | `origin/pilot/MFA-POLICY-2490` (slice 5, `490cade3c`) | `gen_wire_types.py`, `routers/__init__.py`, `routers/settings.py`, `settings_store.py`, `backup.py` (all additive), `ha_user_auth.py` bearer sign-in | additive lists: both; bearer audit row keeps slice 6's `token_kind`, then slice 5's `mfa_provenance.observe`, then slice 6's `note_bearer_use` |
| 4 | `27c031e0e` | `origin/pilot/MFA-DEVICEKEY-2490` (slice 8, `a49a987ef`) | 12 files | `methods_of` = totp, passkey, device_key; verify routes passkey and device_key to their own verifiers; `second_factor_need` under `required`: an active phone key answers `code`, else slice 5's `ha_mfa` / `enroll`; the sign-in factor check is phone key OR the recovery-aware `verify_factor`; `local_identity.second_factor_step`: slice 7's `method = "totp"` reset removed (it hid a phone-key answer); additive lists both |
| 5 | `17ddff812` | `origin/pilot/MFA-DEVICEKEY-ATTEST-2490` (slice 9, `cf7874661`; added on the lead's note) | none | - |

Not merged: nothing else (the lead's first instruction excluded slice 9; the later note added it).

**Semantic conflicts found by the tests (not textual):** slice 5's `test_long_lived_rule_falls_back_to_the_token_lifetime_when_the_listing_drifts`
assumed the fake core's long-lived token lives 30 minutes; slice 6 gave it HA's real lifespan (years), so the lifetime fallback rightly
refuses it - the test now checks both directions (years -> refused, a normal 30-minute token -> allowed). Slice 8 added the notice source
`security.device_key_added` without regenerating the bill-ledger golden SQL trace (the notice seed is traced); regenerated here together
with SR-3's new source.

**Migrations** after the merges: `0219_remote_token_uses`, `0220_recovery_codes`, `0221_factor_policy`, `0222_device_keys`,
`0223_device_key_attested` - unique and contiguous after the 2.50 rows' 0217 / 0218 (no renumbering was needed; every branch already
used the train allocation).

**Step-up verify method pattern**: `^(totp|passkey|recovery_code|device_key)$`; wire `StepUpProof.method` = the same four,
`StepUpStatus.methods` = totp | passkey | device_key.

**Generated**: `frontend/src/api/generated/wire-second-factor.ts` (`scripts/gen_wire_types.py`), `contracts/API_INVENTORY.md`
(`scripts/api_inventory.py`: 1916 -> 1925 routes = + 2 recovery-code, + 2 factor-policy, + 5 phone-key routes).

## 2. The fixes (each with its regression test)

New test file `tests/test_mfa_secfix_2500.py`; the review's `tests/test_mfa_secreview_2500.py` is brought in with every `xfail` marker
removed (each is a plain regression test now).

| Finding | Fix | Tests |
|---|---|---|
| **SR-1** passkey-only administrator resets another user's factor with no step-up | closed by slice 3 (`step_up.once_proof` uses `methods_of`) | review `test_sr1_...` |
| **SR-2** the administrator's reset left passkeys / phone keys | `second_factor.remove_every_factor`: the authenticator code (active or pending) with its lockout and recovery codes, EVERY passkey (`auth_webauthn_credentials`), EVERY phone key (`device_keys.revoke_all`, reason `admin_reset`); then the target's step-up proofs (once-proofs too), sign-ins and device tokens end as before. `FactorReset` answers `{removed, totp, passkeys, device_keys, recovery_codes}`; the audit row carries the counts; the user's notice (`security.second_factor_reset`) and the screen's confirm / done texts say what was removed (he + en). An Arx-only identity in passkey-only mode falls back to its password (`local_passkeys.only_effective` needs a usable passkey - never a lock-out). | review `test_sr2_*` (passkey, phone key); `test_sr2_the_reset_removes_every_factor_kind_and_says_so`, `test_sr2_the_reset_ends_the_targets_proofs` |
| **SR-3** a first factor enrolled from a stolen old session | `step_up.require_first_factor_freshness(action)`: a user with NO step-up method needs a sign-in of this session within `RECENT_SIGN_IN_S` = 300 s (the existing "fresh sign-in" rule of Arx-only passkey registration, `local_passkeys.RECENT_AUTH_S`) - else 403 `reauth_required` (sign in again); a user who has a method needs a fresh proof (strict, below) - only while `security.step_up` is on (owner Q2 = b, section 5). Applied to the TOTP enrolment start (`auth.second_factor.enroll`, new: also a user who already has a passkey / phone key now needs a proof), the passkey registration options, the phone-key registration. The local channel (Ingress) stays the break-glass path. The sign-in time is the chain start of an Arx-only session, the cookie chain / bearer sign-in of an HA session, the creation of an app session. Notices: new source `security.second_factor_added` (the account's own user on every device: inbox, web push, the app) on a TOTP confirm and a passkey registration; the phone key keeps slice 8's `security.device_key_added`. | review `test_sr3_*` (TOTP, passkey); `test_sr3_a_fresh_sign_in_enrols_and_the_user_is_told`, `..._stale_session_cannot_enrol_the_authenticator_and_it_is_audited`, `..._cannot_register_a_first_phone_key`, `..._the_local_channel_is_not_limited`, `..._a_passkey_is_announced_too` |
| **SR-4 + W-1** a recovery code laundered into new codes / used for once-actions (owner questions page Q13, recommendation built) | A recovery code is a step-up proof for the normal window only. `step_up.NO_RECOVERY_ACTIONS` = the once-actions (factor reset, bridge-key reveal, passkey removal once-action) + `FACTOR_ADD_ACTIONS` (TOTP enrolment, a new batch of recovery codes, passkey registration, phone-key registration): `POST auth/step-up/verify {method: recovery_code, action: <one of them>}` answers 409 `step_up_method_refused` BEFORE the code is read (not spent), audited `auth.step_up.failed`. `fresh_proof` (every factor-ADD check) is strict: a mark made with a recovery code (`recovery_code`) or a sign-in answered with one (`sign_in:recovery_code` for HA sign-ins - `_check_second_factor_sync` now returns the method; `step_up.note_recovery_sign_in` for an Arx-only sign-in) never counts; `mark_once` refuses a recovery method outright. Removing one's own lost passkey / phone key may still rest on a recovery-code proof (`strict=False`; the lost-device path, as slice 7's `disable`). | review `test_sr4_...`; `test_w1_a_recovery_code_is_refused_for_a_once_action_and_not_spent`, `test_sr4_a_recovery_code_sign_in_never_mints_codes_but_counts_for_the_window`, `test_sr4_a_recovery_proof_never_adds_a_phone_key` |
| **SR-5** the proof window follows the wall clock | marks use `time.monotonic()` (`step_up._now`); every age check is `0 <= age <= limit` (`_fresh`), so a negative age never counts - marks, once-proofs, the Arx-only `factor_at` and the sign-in age (compared with the wall clock `_wall()`). Answers (`valid_until`) convert a monotonic end to wall time. Stored instants (session sign-in, `factor_at`) are written with `time.time()` and measured on it. | review `test_sr5_...`; `test_sr5_marks_run_on_the_monotonic_clock`, `test_sr5_a_local_sign_in_in_the_future_never_counts` |
| **SR-6** a restore brings back a removed passkey | passkeys leave the archive: `auth_webauthn_credentials` moved from `ACCESS_TABLES` to `NEVER_EXPORTED_TABLES` (like TOTP, recovery codes, phone keys); an older archive's passkey rows are ignored. Because deleting `users` cascades to the table, a restore sets the CURRENT passkeys aside and puts them back for the users the restored directory still has; the restore answer lists `auth_webauthn_credentials` in `kept_current`. This reverses USR2 phase 4's "public keys travel" (recorded; question 5.2). | review `test_sr6_...`; `test_sr6_a_restore_keeps_the_passkeys_as_they_are_now`; `test_local_passkeys.py::test_backup_carries_no_passkey_and_never_the_passkey_settings` (was `..._public_keys_only_...`) |
| **SR-7** delegated administrator's permission changes ungated | closed by slice 3 (`rbac_admin.assigns_anywhere` -> `step_up.on_grant`) | slice 3's route-table ratchet (`test_mfa_stepup_gates_2490.py`) |
| **W-2** phone-key-only administrator cannot do a once-action | `routers/device_keys.verify_step_up`: a challenge signed for a once-action gives a once-proof for exactly that action (any channel, any switch), audited `once: true`; a factor change of the caller's own needs a proof whatever the switch says (as passkeys / code) | `test_w2_a_phone_key_only_administrator_does_a_once_action` |
| **W-3** proofs are not action-bound | unchanged (consistent with the TOTP design); noted | - |
| slice 3 finding 3: `alarm_arm_custom_bypass` on the generic device route | `ha_bridge.ACTIONS[...alarm_arm_custom_bypass]` carries `grant="alarm.bypass"`: the route answers 403 `grant_required` without it (general entity control never implies it), as `HA_IDENTITY_RBAC_HE.md` says | `test_arming_with_a_bypass_on_the_generic_route_needs_alarm_bypass` |
| settings texts | `stepUp.settingsSub` and `stepUp.mineNoMethod` (he + en) name every method (code, passkey, phone key, recovery code) and the physical actions; backend `REQUIRED_HE`, `PHYSICAL_HE`, the reset's `STEP_UP_HE` and `RECOVERY_STEP_UP_HE` likewise | `frontend/tests/unit-mfa-secfix-2500.spec.ts`; `evidence-second-factor.spec.ts` (reset done text) |

Other edits: `verify` routes every factor change through `step_up.FACTOR_CHANGE_ACTIONS` (was the passkey pair only), so a TOTP proof for
a new recovery batch or a phone key works with the switch off too.

## 3. Files

Backend: `services/step_up.py`, `services/settings_store.py`, `services/second_factor.py`, `services/user_passkeys.py`, `services/ha_user_auth.py`,
`services/local_identity.py`, `services/backup.py`, `services/notify_policy.py`, `services/notify_sources.py`, `services/ha_bridge.py`,
`routers/second_factor.py`, `routers/device_keys.py`, `wire/second_factor.py`. Tests: `tests/test_mfa_secfix_2500.py` (new),
`tests/test_mfa_secreview_2500.py` (from the review branch, markers removed), `tests/test_local_passkeys.py`,
`tests/test_mfa_policy_2490.py` (merge semantic conflict), `tests/test_second_factor.py` / `tests/test_security_review_220.py` (the
reset answer), `tests/fixtures/bill_ledger_b_sql_golden.json` (two notice sources). Frontend: `screens/system-diagnostics.ts` (switch fallback `off`), `i18n/he.ts`, `i18n/lang/en/i18n/en.ts`, `tests/unit-mfa-secfix-2500.spec.ts` (new), `tests/evidence-second-factor.spec.ts`.
Generated: `wire-second-factor.ts`, `contracts/API_INVENTORY.md`. Docs: this note, `docs/changes/MFA-STEPUP-TRAIN-2490.md` (5.1 resolved).
More tests touched for the owner's default: `tests/test_mfa_stepup_2490.py`, `test_mfa_passkeys_2490.py`, `test_mfa_recovery_codes_2490.py`,
`test_mfa_stepup_gates_2490.py`.

## 4. Tests (real runs)

### 4.1 Workstation (Windows, the main checkout's `.venv`, `SW_WIRE_STRICT=1`, `-o addopts=""`, ONE file per pytest process)

Final run at `1f7c2915a` (every backend change; the later `1331c2077` is the settings screen's fallback only):

| File | Result |
|---|---|
| `test_mfa_secfix_2500.py` (new) | **17 passed** |
| `test_mfa_secreview_2500.py` (the review's, markers removed) | **8 passed** (SR-1, SR-2 x2, SR-3 x2, SR-4, SR-5, SR-6) |
| `test_mfa_stepup_2490.py` | **22 passed** |
| `test_mfa_stepup_gates_2490.py` (incl. the route-table ratchet) | **19 passed** |
| `test_mfa_passkeys_2490.py` | **26 passed** |
| `test_mfa_tokens_2490.py` | **22 passed** |
| `test_mfa_recovery_codes_2490.py` | **21 passed** |
| `test_mfa_policy_2490.py` | **70 passed** |
| `test_mfa_devicekey_2490.py` | **19 passed** |
| `test_mfa_devicekey_attest_2490.py` | **23 passed** |
| `test_second_factor.py` | **23 passed** |
| `test_second_factor_followups.py` | **11 passed** |
| `test_security_review_220.py` | **37 passed** |
| `test_local_passkeys.py` | **73 passed** |
| `test_wxh4_emergency_revoke_2407.py` (bridge-key reveal, a once-action) | **22 passed** |
| `test_service_identity.py` | **47 passed** |
| `test_service_identity_extended.py` | **89 passed** |
| `test_bill_ledger_lifecycle_b.py` | **25 passed** |
| `scripts/gen_wire_types.py`, `scripts/api_inventory.py` | regenerated (wire-second-factor.ts; 1925 routes) at `a7ba23483` |

Red runs on the way (each fixed, then the table above): at `a7ba23483` the stepup file failed one test (the test clock also moved the
wall clock, so a session made after `clock.advance` looked old to the SR-3 rule -> `895b628cc`: stored instants are measured on the
real clock, the marks on the monotonic one); at `895b628cc` `test_mfa_policy_2490` 1 failed (the slices 5 / 6 semantic conflict,
section 1), `test_second_factor` 1 failed and `test_bill_ledger_lifecycle_b` 1 failed (golden trace) -> `92d3b6edd`. The recovery file
also passed (21) right after merge 2.

Not run on the workstation by rule (memory): ruff, tsc, eslint, every Playwright spec, the backend families.

### 4.2 Runner (slot B, ONE job `~/work/mfasecfix_run.sh`, queued 2026-11-24 ~08:44 UTC via `setsid nohup ~/work/slotb.sh`)

First lease (~11:37 UTC): **wasted by my own script** - the worktree step failed (`git fetch` / `worktree add` chained with `&&`)
and the job ran in `~/smplwisebms` with every file "MISSING"; killed by me, the stray `~/smplwisebms/node_modules` symlink it made was
unlinked (nothing else changed there: `git status` clean). The script now aborts when the worktree / checkout fails. Re-queued; the
lease started 11:48:52 UTC at `e2cd064a0` (log: `~/work/mfasecfix-out/summary.txt`, per-step logs beside it).

| Step | Result |
|---|---|
| the 22 MFA / auth files, one pytest process each (`SW_WIRE_STRICT=1`) | **20 green**: secfix 17, secreview 8, stepup 22, gates 19, passkeys 26, tokens 22, recovery 21, policy 70, devicekey 19, attest 23, second_factor 23, followups 11, local_passkeys 73, wxh4 22, service_identity 47, service_identity_extended 89, migrations 4, bill ledger 25, security_review_220 37, secfix2_pub07 35 |
| `test_local_auth_inventory.py` | 1 failed / 3 passed: `GET /auth/tokens` (slice 6) resolves the identity inside its handler and was not listed (red since slice 6; that slice's runner job never ran) -> listed in `IN_HANDLER` (`c4fb5d22a`), workstation **4 passed** |
| `test_migrations_263_upgrade.py` | 1 failed / 1 passed: `test_the_release_numbers_are_contiguous_and_final` - 0217 / 0218 belong to the 2.50 rows, not on this branch (expected, as slice 7 recorded; green once the release train carries them in order). Not changed. |
| `gen_wire_types.py --check` / `api_inventory.py` | exit 0 / exit 0, no diff |
| `ruff check smplwise` + the two new test files | `smplwise` clean; 32 findings in the two test files: 31 F811 (the fixture-import pattern every MFA test file uses - e.g. `test_mfa_passkeys_2490.py` + `test_mfa_devicekey_2490.py` give 74 of the same) and 1 F841 (fixed, `c4fb5d22a`) |
| `tsc --noEmit` | **exit 0** |
| eslint (MFA components, api, i18n, specs) | exit 0 (4 "file ignored" warnings for the spec files) |
| node unit `unit-step-up-client.spec.ts` | **6 passed** |
| Playwright desktop + mobile `--workers=2`: `unit-mfa-secfix-2500`, `unit-mfa-train-2500`, `unit-step-up-ui`, `unit-mfa-passkeys-2490`, `unit-mfa-recovery-codes-2490`, `evidence-access-tokens`, `evidence-second-factor`, `unit-second-factor-admin-ui` | **60 passed, 2 failed, 20 skipped** (the shot tests without `SW_SHOTS_DIR`). Failed: `unit-mfa-passkeys-2490` "the authenticator code answers the step-up; a wrong code says so; cancel sends nothing" (desktop + mobile) - after cancelling the in-place proof the row stayed armed, so the remove button never came back (slice 4's component; never run on a runner before). Fixed in `sw-passkeys.ts` (cancel also disarms the row, `c4fb5d22a`); **re-run NOT_RUN** (one job per agent). |
| compare shots after / before (`unit-mfa-secfix-2500` "shots", base `6f40529bb`) | 4 + 4 files; page `private/planning/mfa_secfix_compare_2026-11-24.html` (built by `private/planning/mfa_secfix_compare_build_2026-11-24.py`) |
| backend families: 168 files (auth / identity / remote / passkey / second factor / step-up / access / app session / bridge key / backup / security / wire / settings / migration / rbac / alarm / door / emergency / notify policy / privacy / delegation) in shards of 40 | **NOT_RUN to the end within the time box**: shard 0 was at 13 % at 12:41 UTC (about 70 minutes per shard). The lease keeps running; results land in `~/work/mfasecfix-out/summary.txt` (`chunk_00..04` lines + `chunk_*.log` / `.xml`). |

## 5. Owner answers applied (questions page 24.11, relayed by the lead)

| Answer | Applied |
|---|---|
| **Q2 = b** (not the recommendation): `security.step_up` defaults to OFF; Q5 note "never ask for re-confirmation unless I switched it on"; Q3 note "no re-confirmation on every remote connection" | `settings_store.DEFAULTS["security.step_up"] = "off"`, `step_up.DEFAULT_ON = "off"`, the settings screen's fallback `off`. With the switch off the train asks nothing beyond 2.49.0: the window gate and the physical gates (disarm / bypass / door) already followed the switch; the proofs the slices added for the caller's own factor changes (passkey add / remove for a user who is not an Arx-only identity, a new batch of recovery codes, phone-key add / revoke, a code enrolment next to another factor) are asked only while it is on (`step_up.factor_change_proof_on`). Still asked with the switch off, as before the train: the once-actions that always demanded their own code (another user's factor reset, the bridge-key reveal, the administrator's removal of an Arx-only identity's passkey) and an Arx-only identity's own fresh-sign-in rules. **SR-3 stays**: a FIRST factor needs a recent sign-in - a re-sign-in, not a code prompt. Restore: unchanged (the step-up keys are in `SETTINGS_KEEP`, never restored). Tests: the shared `arx` fixture and the gated-alarm fixture switch it on (what the second-factor tests were written for); `test_the_switch_is_off_by_default`, `test_with_step_up_off_only_what_2490_asked_is_asked`, the passkey / recovery tests of the switched-off path. `docs/changes/MFA-STEPUP-TRAIN-2490.md` contradiction 5.1 marked resolved. |
| **Q13 = a** | as built (section 2, SR-4 + W-1) |
| **Q14 = a** | no forced re-enrolment after a recovery-code sign-in (comes with the screens slice) - nothing built |
| **Q1 a / Q4 a / Q6 a** | users without a factor allowed, bearer (long-lived) exempt, `system.configure` + step-up audited - as built |

## 6. Open questions (recommendation first; built to the recommendation)

1. **Recovery code and one's own factor REMOVAL.** (a) allowed with a recovery-code proof (the lost-device path, like slice 7's
   `disable`), refused for adding a factor and for minting codes [built]; (b) refuse removals too.
2. **Passkeys out of backups (SR-6).** (a) never exported, a restore keeps the current ones [built: the simplest correct option, as
   the task asked]; (b) keep exporting them and restore only the intersection with today's rows (keeps passkeys on a move to a new
   host, more code). This reverses USR2 phase 4's "public keys travel"; a move to a new host means registering passkeys again.
3. **TOTP enrolment by a user who already has a passkey / phone key** now needs a fresh step-up proof while step-up is on (new, by the
   same rule as a second passkey / phone key; nothing with the switch off). (a) keep [built]; (b) leave the code enrolment ungated for them.
4. **Who hears of a new factor.** (a) the account's own user on every device, like `security.device_key_added` [built]; (b) also the
   managers (a second source; the notice policy has one recipient rule per source).
5. **The step-up dialog (slice 2 UI)** offers the code and the passkey only; a phone key / recovery code is accepted by the server but
   not offered in the dialog. (a) the screens slice (11) adds them [recommended]; (b) now.
6. **Fresh-sign-in window for a first factor.** (a) 5 minutes, the existing Arx-only passkey rule [built]; (b) 10 minutes.
