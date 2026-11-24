# MFA-RECOVERY-CODES-2490 - one-time recovery codes (slice 7 of the second-factor train)

Branch `pilot/MFA-RECOVERY-2490`, cut from `origin/pilot/MFA-STEPUP-2490` at `fb9a3ac1e` (slice 1, STEPUP-CORE). Train note:
`docs/changes/MFA-STEPUP-TRAIN-2490.md`; task card `MFA-STEPUP-TRAIN-2490` (`origin/chore/MGMT-OWNER-ANSWERS-2211:management/tasks.json`).
Owner decision implemented: **Q49 (2026-11-22) - recovery codes, 10 per user, each usable once.** No merge, no version bump, no
changelog entry, no tag, no lab, Home Assistant, NVR or go2rtc contact. Fakes only.

Inputs read: `AGENTS.md`, `CLAUDE.md`, `MASTER_SPEC_HE.md` and `docs/security/` (both silent on recovery codes),
`docs/changes/CR-011-SECOND-FACTOR.md` (option B: "10 single-use recovery codes stored as scrypt hashes"), the design
`docs/design/full-2fa-t095/DESIGN.md` on `origin/pilot/FEATURE-DESIGNS-SEC-2490` (4.5, 6, 7, 8.1 T7 / T9), the slice-1 note and code,
`private/planning/answers_2026-11-22_night.txt`.

## 1. What changed

### 1.1 Backend

| Piece | What |
|---|---|
| `migrations/0220_recovery_codes.sql` (new) | `auth_recovery_codes(id, user_id, batch_id, code_hash, created_at, used_at, used_for)` + index `(user_id, used_at)`. Additive; the previous version ignores it. **Number 0220**, the lead's train allocation (2026-11-24): main ends at 0216, the 2.50 rows hold 0217 (camera discovery origin) and 0218 (multi-building home), slice 6 TOKENS 0219, slice 5 POLICY 0221, slice 8 DEVICEKEY 0222 (first built as 0219 after a check of every `origin/*` head; renumbered on the lead's note). Renumber at merge only if the order changed. |
| `services/recovery_codes.py` (new) | 10 codes per batch, `XXXX-XXXX` Crockford base32 (40 random bits each; `O`/`I`/`L` read as `0`/`1`/`1`, case / spaces / dash ignored). Stored only as scrypt PHC hashes through the repository's password primitive `local_passwords.hash_password` with a recovery profile (`ln=14, r=8, p=1`, ~16 MiB: a machine-made 40-bit secret does not need the 128 MiB password cost, and a check of up to 10 hashes stays well under a second); compared by `local_passwords.verify` (constant time). `generate` deletes the previous batch first; `consume` marks one code spent with a conditional UPDATE (single use also under two concurrent requests); `verify_factor` = the factor step: a recovery-shaped text is checked against the codes, anything else goes to the authenticator check; wrong recovery codes count towards the SAME lockout as wrong authenticator codes (`second_factor.FAILURES`: 5 wrong in 5 min -> 10 min). `audit_use` writes `auth.recovery_code.used` (where, how many remain, `low`) - never the code. |
| `services/local_passwords.py` | `hash_password(password, profile=None)`: an optional cost profile (verification already reads the cost from the PHC string). |
| `services/second_factor.py` | `remove()` also deletes the user's recovery codes (own removal and an administrator's reset both go through it). |
| `services/ha_user_auth.py` | The remote sign-in's factor step (`X-Arx-Second-Factor`, the cookie exchange and the bearer path) accepts a recovery code in place of the authenticator code; a use is audited; a failed one is audited with `method: recovery_code`. |
| `services/local_identity.py` | The Arx-only sign-in's second step accepts a recovery code; the sign-in row says `factor: recovery_code`. |
| `services/step_up.py` | `METHOD_RECOVERY`; `fresh_proof()` - whether the session holds a proof that counts now (a one-shot proof is spent by the check). |
| `routers/second_factor.py` | `confirm` answers `FactorEnabled` = the status + `recovery_codes` (the first batch, shown once). `disable` accepts a recovery code (the lost-phone path: remove, then enrol again). `POST auth/step-up/verify` accepts `method: "recovery_code"` (a 6-digit code sent under that method is a wrong code, counted). New `GET auth/recovery-codes` (`RecoveryStatus {available, remaining, total, created_at, last_used_at, low, low_at}`) and `POST auth/recovery-codes {code?}` (`RecoveryBatch {codes, ...status}`): a new batch needs a fresh step-up whatever `security.step_up` says - a proof that counts now on this session, or the CURRENT authenticator code in the body / header (never a recovery code); refused -> 403 `step_up_required` (`details.action = auth.recovery_codes.regenerate`), audited denied. Generation audited `auth.recovery_codes.generated {reason: enrolment / regenerate, count, voided}`. |
| `wire/second_factor.py` | `FactorEnabled`, `RecoveryStatus`, `RecoveryBatch`; `StepUpProof.method` adds `recovery_code`. |
| `services/backup.py` | `auth_recovery_codes` in `NEVER_EXPORTED_TABLES` (factor material never travels, like `auth_totp`). |
| `services/local_privacy.py` | A purged local user's codes are deleted. |
| generated | `frontend/src/api/generated/wire-second-factor.ts`, `contracts/API_INVENTORY.md` (1914 routes). |

Where a recovery code is accepted: the remote sign-in factor step, the Arx-only sign-in's second step, a step-up proof, removing
one's own factor. Where it is NOT: a new batch of codes, the administrator's own code for a reset of someone else, the bridge-key
reveal, a passkey removal, a password change (those keep asking for the live authenticator code).

### 1.2 Screen (minimal, module look kept)

`החשבון שלי › אימות דו־שלבי` (`components/sw-second-factor.ts`, the card's existing tokens and controls; no new look):

- after the enrolment's first code: the ten codes in a monospace two-column list, "save them, shown only now, each works once",
  **העתקה** (clipboard, one per line), **הורדה** (`arx-recovery-codes.txt`), **שמרתי את הקודים** (the list is gone for good - never
  stored in the page, storage or state after that);
- with the factor on: a "קודי שחזור - N מתוך 10 זמינים" row, a warning when 3 or fewer remain ("נשארו מעט...") or none ("לא נשארו..."),
  and **קודים חדשים**: asks the current authenticator code, then shows the new batch once;
- removing the factor: a "שימוש בקוד שחזור" switch on the code field (letters keyboard, `XXXX-XXXX` placeholder).

Sign-in page (`arx/arx-login.ts`), the Arx code step only (not HA's own MFA step): a "שימוש בקוד שחזור" switch with the same field
changes. Strings in Hebrew and English (`secondFactor.recovery*` in `i18n/he.ts` and `i18n/lang/en/i18n/en.ts`); Arabic / Russian fall
back to Hebrew like the rest of the section.

Compare page: `private/planning/mfa_recovery_compare_2026-11-24.html` (before = slice-1 head `fb9a3ac1e`, after = this branch;
desktop 1440 + phone 390, light + dark; screenshots made on the test server with mocked routes).

## 2. Contradictions recorded (not resolved silently)

1. **Recovery code as a step-up proof.** The lead's instruction for this slice says "usable at sign-in ... and as a step-up proof".
   The design (`DESIGN.md` 4.2 method table, 4.5, 8.1 T7 / T9) and the slice-1 plan row 7 say "never a step-up method; recovery codes
   only restore sign-in / re-enrol". `MASTER_SPEC_HE.md` and `docs/security/` are silent, so the active task instruction wins over the
   design asset. **Implemented: accepted as a step-up proof**, with the normal window (like the authenticator code), single use,
   shared lockout, audited `auth.step_up.ok {method: recovery_code}` + `auth.recovery_code.used {used_for: step_up}`. Open question 4.1.
2. **Forced re-enrolment after a recovery sign-in.** Design 4.5 / F8: a recovery code "forces re-enrolment of a new factor before
   anything else". Not in the lead's instruction; not built (it needs the enrolment-only session state of the policy slice 5 / screens
   slice 11). Today a recovery sign-in is a normal factor-backed sign-in (also a fresh sign-in proof, as with the code). Open question 4.2.
3. **`security.recovery_codes` switch.** Design 6: off by default. The owner answered Q49 "yes" (10 codes per user), so the codes
   are simply on with the factor - no switch. Recorded; open question 4.3.
4. **User notice on use.** Design 4.5 / T7: "using one notifies the user and managers". Not built: a new notification source changes
   the notify policy seed (the golden SQL fixture of the bill ledger and the source catalogue in the UI). Audit rows only in this
   slice. Open question 4.4.
5. **Passkey-only (Arx-only) users** have no recovery codes: the codes belong to the authenticator factor (the only step-up method
   of slice 1). A passkey user's recovery stays the administrator's reset. Noted for slice 4 (passkeys for all).

## 3. Overlaps with the parallel slices

- Slice 2 (`pilot/MFA-STEPUP-UI-2490`): the step-up sheet may offer `recovery_code` - `POST auth/step-up/verify` accepts it now;
  `GET auth/step-up` `methods` is unchanged (`["totp"]`) so slice-1 tests and the sheet's method list do not move. Both branches touch
  `wire/second_factor.py` and the generated `wire-second-factor.ts` (regenerate after the merge) and `i18n/he.ts` / `en.ts`
  (`secondFactor` block; additive keys).
- Slice 3 (`pilot/MFA-STEPUP-GATES-2490`): both edit `routers/second_factor.py` (this branch: `confirm`, `disable`, the step-up
  verify body and a new section at the end; slice 3: the admin reset / `require_step_up`). The admin reset itself is unchanged here
  (the code deletion lives in `second_factor.remove`). Migration numbers follow the lead's allocation (0219 TOKENS, 0220 this slice, 0221 POLICY, 0222 DEVICEKEY).

## 4. Open questions (recommendation first)

1. Recovery code as a step-up proof: (a) keep it, as built (lost phone + an urgent settings change still possible; single use,
   audited) [recommended, the lead's instruction]; (b) make it a one-shot proof (good for one change within 60 s); (c) drop it, as the
   design says.
2. After a recovery sign-in: (a) no forced re-enrolment now; the screen nudges (count / warning) and slice 11 adds the forced step
   [recommended]; (b) force re-enrolment already in this slice.
3. A switch for recovery codes: (a) none - on with the factor (owner Q49) [recommended]; (b) `security.recovery_codes` on/off.
4. Notice on use: (a) add a `security.recovery_code_used` notice to the user in the screens / review slice, with the golden fixture
   update [recommended]; (b) audit only.

## 5. Tests (real runs)

New tests: `smplwise_vms/backend/tests/test_mfa_recovery_codes_2490.py` (21: format, hashes only, first batch at enrolment, sign-in with
a code once, reuse refused, codes of one user do not open another, shared lockout at sign-in and at step-up, regenerate needs a fresh
step-up and voids the old batch (also with the switch off), enrolment proof counts, step-up proof once, a 6-digit code under
`recovery_code` refused, `passkey` refused on this branch, removal with a recovery code, admin reset deletes codes, the admin's own
code is never a recovery code, low warning, single use + the hash primitive, the production scrypt profile, the Arx-only sign-in
step, backup / privacy plumbing, wire models) and `frontend/tests/unit-mfa-recovery-codes-2490.spec.ts` (4 + the compare-shot test).

| Where | Head | Command | Result |
|---|---|---|---|
| workstation (one file) | `db58e5520` | `pytest tests/test_mfa_recovery_codes_2490.py` | 20 passed |
| workstation (one file each) | `efaeb9e85` | `test_mfa_stepup_2490.py` / `test_second_factor.py` / `test_second_factor_followups.py` | 22 / 23 / 11 passed |
| workstation (one file) | `1384b3f3d` | `pytest tests/test_mfa_recovery_codes_2490.py` | 21 passed |
| workstation | `4bec3787c` | `scripts/design_ratchet.py` | no count above the baseline (px-literal 25485 = baseline) |
| test server, slot B | `efaeb9e85` | `tsc --noEmit -p frontend` | exit 0 |
| test server, slot B | `b2dc67ad7` | `tsc --noEmit -p frontend` | exit 0 |
| test server, slot B | `efaeb9e85` | Playwright desktop + mobile `--workers=2`: this spec, `evidence-second-factor`, `unit-second-factor-admin-ui`, `evidence-android-download` (vite dev server) | 46 passed, 2 skipped (the compare-shot test without `SW_SHOTS`) |
| test server, slot B | `b2dc67ad7` | the same | 45 passed, 1 failed, 2 skipped: `evidence-android-download` [mobile] `page.screenshot` timeout - the worktree was switched to `4bec3787c` under the running dev server (my own action); it passed in the run above. Not re-run (see below). |
| test server, slot B | `efaeb9e85` | backend, 129 files (second factor / step / recover / local identity / passkeys / remote / wire / route / backup / privacy / security / rbac / settings / access / migrations / schema ...), 6 shards, `-o addopts=""` | shard 0: 535 passed, **1 failed** `test_build_guards_2438::test_the_checkout_is_at_or_below_its_baseline` (px-literal 25485 -> 25499 from my CSS; **fixed** in `4bec3787c`, `test_build_guards_2438.py` then 10 passed on the server); shard 1: 1341 passed, 4 skipped, **1 failed** `test_migrations_263_upgrade::test_the_release_numbers_are_contiguous_and_final` (expected on this branch: 0217-0219 belong to other rows; green once the train merges them in order); shard 2: 570 passed; shard 3: 429 passed; shard 4: **BLOCKED** - killed by its 3000 s timeout while the server ran at load ~200 (other agents; no failure seen in its output before the cut, 3 xfail); shard 5: NOT_RUN (stopped by me to relieve the overloaded server) |
| test server | `7018cd613` | `scripts/gen_wire_types.py`, `scripts/api_inventory.py` | regenerated and committed |

NOT_RUN: the full backend suite (slot A, the release gate's), pixel baselines, axe, any lab check, Playwright and the backend shards at
the final head `1384b3f3d` (the last commit only renumbers the migration file and adds the `passkey` refusal; the recovery test file
was re-run on the workstation at that head: 21 passed).
The test server was unreachable for ~25 minutes around 04:00 UTC (load average 178-240); my queued re-run at `4bec3787c` never got a
slot and was cancelled. Recommended before the train merge: shards 4-5 and the Playwright set at the final head.
