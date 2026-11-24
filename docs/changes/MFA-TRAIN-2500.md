# MFA-TRAIN-2500 - the second-factor train: slices 1, 2, 4 and 6 integrated on one branch

Branch `pilot/MFA-TRAIN-2500`, cut from `origin/pilot/MFA-STEPUP-2490` (slice 1, `fb9a3ac1e`). Later slices (3 `MFA-STEPUP-GATES`,
7 `MFA-RECOVERY`, both still being built) merge into this branch. No version bump, no changelog entry, no tag, no lab / Home
Assistant / NVR / go2rtc contact. Inputs read: `AGENTS.md`, `CLAUDE.md`, `docs/changes/MFA-STEPUP-TRAIN-2490.md` (slice 1 + train plan),
the commit of slice 2 (it has no change note of its own), `docs/changes/MFA-PASSKEYS-2490.md` (slice 4), `docs/changes/MFA-TOKENS-2490.md`
(slice 6).

## 1. Merge order

All three slices were cut from the same commit (`fb9a3ac1e`, slice 1), so each merge is a three-way merge onto slice 1.

| # | Merge commit | Branch (head) | Textual conflicts |
|---|---|---|---|
| 1 | `2a3a6a74d` | `origin/pilot/MFA-STEPUP-UI-2490` (slice 2, `423f580c7`) | none |
| 2 | `01af36896` | `origin/pilot/MFA-PASSKEYS-2490` (slice 4, `ca64a6fcd`) | none |
| 3 | `f112ae586` | `origin/pilot/MFA-TOKENS-2490` (slice 6, `cb75cae6c`) | none (`services/step_up.py` auto-merged: slice 4 edits `methods_of` / `METHOD_PASSKEY` / `fresh_proof`, slice 6 the bearer branch of `not_applicable`) |
| 4 | `d597eec2b` | integration commit (this note, 2) | - |

## 2. Semantic conflicts and how each was resolved

1. **A passkey-only user could not pass the central gate in the UI** (slice-4 note, section 3, merge blocker). Slice 4 makes a user whose
   only factor is a passkey gated (`methods_of` lists `passkey`); slice 2's `sw-step-up-dialog` offered the code only and showed "no
   method" to that user. Resolved: the dialog offers **"אישור במפתח גישה" / "Confirm with a passkey"** whenever the gate lists `passkey`
   and the browser has passkeys (`passkeysSupported()`); the button runs `passkeyStepUp(action)` (`api/step-up-passkey.ts`: challenge,
   the device, verify), fires `STEP_UP_VERIFIED` and answers true - the client then re-sends the refused request **once**, exactly as
   after a code (the retry-once rule is unchanged: the dialog answers once, the client never retries the retried request). Layout:
   passkey only -> the passkey button alone (primary) and no confirm button; both methods -> the passkey (secondary), "או" / "or", the
   code field, and the footer's confirm for the code; the body text names what is offered. A server refusal or a cancelled / failed
   device ceremony keeps the dialog open with the reason (`stepUp.passkeyCancelled`, or the server's message). A listed passkey in a
   browser without passkeys and no code -> "this browser does not support passkeys". `stepUp.noMethod` now says "no authenticator app
   or passkey". Same component, same `sw-dialog`, `sw-button`, tokens: the module look is kept. Hebrew (`i18n/he.ts`) and English
   (`i18n/lang/en/i18n/en.ts`).
2. **Two prompts for one passkey change in My Account** (slice-4 note: "the dialog opens first and the in-place confirmation only appears
   when the dialog is cancelled"). Slice 2's client interceptor catches every 403 `step_up_required` that names `verify_path`; slice 4's
   factor-change refusals (`auth.passkey.register` / `auth.passkey.remove`, `services/user_passkeys.proof_required`) name it too, and
   `sw-passkeys` confirms them in place (passkey + code next to the change). Resolved by keeping both behaviours, one per path: a request
   may carry the client-side marker `STEP_UP_INLINE` (`X-Sw-Step-Up-Inline`, `api/client.ts`); `fetchApi` takes it off before the
   request leaves (it never reaches the server) and leaves that answer's 403 to the screen. `api/passkeys.ts` sets it on the own
   register options, register and remove calls only. Everything else - the central gate, the administrator's passkey removal of another
   user - still opens the shell dialog. Recommended alternative left open (question 5.1).
3. **Two clients for the code proof** (`api/second-factor.ts verifyStepUp`, slice 2; `api/step-up-passkey.ts verifyCodeStepUp`, slice 4 -
   the same call). Kept one: `verifyCodeStepUp` is now a re-export of `verifyStepUp`.
4. **Generated files of slice 6 missing.** `frontend/src/api/access-tokens.ts` imports `./generated/wire-access-tokens`, which slice 6 never
   committed (its note lists it as generated), and `contracts/API_INVENTORY.md` lacked the three `auth/tokens` routes. Regenerated with the
   repo's generators on the workstation (`scripts/gen_wire_types.py`, `scripts/api_inventory.py`; light, no app start for the first):
   `wire-access-tokens.ts` added, the inventory 1913 -> 1916 routes. The other generated files were unchanged (`--check` clean).
5. **Migration numbers.** After the merge the train adds exactly one migration, `0219_remote_token_uses.sql` (slice 6); slice 4 adds none;
   `tests/test_migrations.py::test_migration_numbers_are_unique` holds. Across all remote branches: `0217_camera_discovery_origin`,
   `0218_mb_home_building` (2.50 branches), `0219_remote_token_uses` (here) and `0220_recovery_codes` (slice 7, already renumbered from an
   earlier `0219_recovery_codes` commit in its history) - no duplicate once slice 7 merges. The base ends at 0216; the gap 0217-0218 is the
   2.50 rows' (the runner applies files in order and records versions, a gap is harmless).
6. **Verify method pattern.** `StepUpBody.method` is `^(totp|passkey)$` (slice 4) and the wire literals `Literal["totp", "passkey"]`;
   unchanged by the merge. Slice 7 will widen it to `^(totp|passkey|recovery_code)$` (slice-4 note, section 3).

Not changed (recorded): slice 3's `PHYSICAL_HE` / `REQUIRED_HE` texts still name "the authenticator code" only - they live on the slice-3
branch, to be fixed when it merges here. The step-up settings card text (`stepUp.settingsSub`) still says "the code from the authenticator
app"; left as is (question 5.2).

## 3. Files (integration commit)

`frontend/src/components/sw-step-up-dialog.ts`, `frontend/src/api/client.ts` (`STEP_UP_INLINE`, `StepUpDetails.challenge_path`),
`frontend/src/api/passkeys.ts`, `frontend/src/api/step-up-passkey.ts`, `frontend/src/i18n/he.ts`, `frontend/src/i18n/lang/en/i18n/en.ts`,
`frontend/src/api/generated/wire-access-tokens.ts` (generated), `contracts/API_INVENTORY.md` (generated),
`frontend/tests/unit-mfa-train-2500.spec.ts` (new: Chromium virtual authenticator with one passkey for `localhost`, mocked wire; the
passkey-only dialog, both methods, a refused passkey then success, cancel after a refusal, compare shots),
`frontend/tests/unit-step-up-client.spec.ts` (+1: the marker is stripped and leaves the 403 to the screen; without it the dialog is asked).

Compare page: `private/planning/mfa_train_compare_2026-11-24.html` (the dialog before / after: both methods and passkey only; desktop +
phone; light + dark; server screenshots).

## 4. Tests (real runs)

| Where | Command | Result |
|---|---|---|
| workstation (Windows, repo venv, `SW_WIRE_STRICT=1`), one file at a time, at `d597eec2b` | `pytest tests/test_mfa_stepup_2490.py` | **22 passed** |
| workstation | `pytest tests/test_mfa_passkeys_2490.py` | **26 passed** |
| workstation | `pytest tests/test_mfa_tokens_2490.py` | **22 passed** |
| workstation | `pytest tests/test_local_passkeys.py` | **73 passed** |
| workstation | `scripts/gen_wire_types.py` then `--check` | wrote `wire-access-tokens.ts`; `--check` clean |
| workstation | `scripts/api_inventory.py` | 1916 routes (+3 `auth/tokens`), committed |
| runner slot B | `~/work/mfatrain_run.sh` (quick backend files incl. `test_migrations.py`, wire `--check`, inventory, tsc, eslint, node unit `unit-step-up-client.spec.ts`, Playwright `unit-mfa-train-2500` + `unit-step-up-ui` + `unit-mfa-passkeys-2490` + `evidence-access-tokens` + `evidence-second-factor` desktop + mobile `--workers=2`, compare shots after / before, backend auth / security families in 4 shards, ruff) | queued 2026-11-24 04:22 UTC behind the night queue; output `~/work/mfatrain-out/summary.txt` |

Not run on the workstation by rule (memory): tsc, eslint, every Playwright spec, ruff (not installed in the workstation venv).
NOT_RUN anywhere: any real device or browser passkey, any lab check.

## 5. Open questions (recommendation first)

1. **One prompt for passkey changes in My Account.** (a) keep the in-place confirmation of slice 4 for the own add / remove and the shell
   dialog for everything else (built) [recommended: the change and its proof stay in one place]; (b) drop the in-place confirmation and
   let the shell dialog (now with the passkey) handle every 403.
2. **Settings card wording.** (a) change `stepUp.settingsSub` to "the authenticator code or a passkey" in the screens slice together with
   slice 3's `PHYSICAL_HE` / `REQUIRED_HE` [recommended]; (b) now.
