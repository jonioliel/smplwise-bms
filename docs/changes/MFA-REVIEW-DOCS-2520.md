# MFA-REVIEW-DOCS-2520 - security review and documentation of the second factor shipped in 2.49-2.51

Branch `pilot/MFA-REVIEW-DOCS-2520`, base `origin/main` = v2.51.0 (`3d71fb183`). No version bump, no changelog entry, no tag, no lab /
Home Assistant / NVR / go2rtc contact, no UI change (no pixel baselines, no compare page needed).

## 1. What and why

1. **Adversarial security review** of everything the second-factor train put into main (step-up, passkeys, phone keys + attestation,
   authenticator code + recovery codes, factor policy, reset hardening, tokens): `docs/security/MFA-REVIEW-2520.md`. Every finding of the
   earlier review (`origin/pilot/MFA-SECREVIEW-2500`: SR-1..SR-7, W-1..W-3) was checked against main - all fixed (SR-3 and SR-4 only while
   step-up is on: see N-1). New findings N-1..N-7 ranked by severity, each with file:line and a scenario, plus four recorded residuals.
2. **Three small, clearly-correct fixes** (each with a regression test that fails on `origin/main`):
   - **N-2 (part)** `routers/local_passkeys.admin_remove`: an administrator's removal of an Arx-only identity's passkey honours
     `security.factor_reset_channel = local` (403 `factor_reset_local_only`, audited `identity.local.user.passkey_removed` denied
     `local_only`), checked before the rate limiter, the lookup and the proof. Default `any`: unchanged.
   - **N-3** `services/factor_reset.sign_in_factor` (new) used by `signs_in_remotely`: the last-administrator rule counts only a factor
     that answers a remote sign-in (Home Assistant user: the code or an active phone key; Arx-only identity: the code or a usable
     passkey). A Home Assistant user's passkey (a step-up method only) no longer makes its holder "an administrator who can sign in
     remotely", so a reset can no longer leave the installation with none.
   - **N-4** `services/ha_user_auth` bearer path: a new bearer sign-in admitted by Home Assistant's own MFA (`ha_mfa_ok`, enforced
     policy) no longer records a step-up proof - HA's MFA was shown when the refresh token was made, not now; the cookie exchange never
     recorded one. It is still marked verified for its next access tokens.
3. **Owner / administrator guide** for the second factor, Hebrew and English: `docs/user-guide/he/82-second-factor_HE.md` (rewritten for
   2.51.0: the four methods, Account > Security, recovery codes, passkeys for users, phone keys, enabling step-up, the factor policy and
   compliance preview, the administrator reset and its limits, the system settings, honest limits) and the new
   `docs/user-guide/en/82-second-factor_EN.md` (the guide's first English page; the folder is new). Index row updated;
   `docs/user-guide/he/GUIDE_ALL_HE.html` rebuilt with `scripts/build_guide.py` (`--check` exit 0).

Bigger issues are proposed rows, not built (review section 4): MFA-FACTOR-ADD-FRESH-2520 (N-1, N-5), MFA-PASSKEY-ADMIN-REMOVE-2520
(N-2 rest), MFA-FACTOR-NOTICES-2520 (N-6), MFA-RESET-CHANNEL-UI-2520 (N-7).

## 2. Files

- `docs/security/MFA-REVIEW-2520.md` (new)
- `docs/changes/MFA-REVIEW-DOCS-2520.md` (this note)
- `docs/user-guide/he/82-second-factor_HE.md`, `docs/user-guide/he/00-INDEX_HE.md`, `docs/user-guide/he/GUIDE_ALL_HE.html` (generated)
- `docs/user-guide/en/82-second-factor_EN.md` (new)
- `smplwise_vms/backend/smplwise/routers/local_passkeys.py` (N-2), `smplwise_vms/backend/smplwise/services/factor_reset.py` (N-3),
  `smplwise_vms/backend/smplwise/services/ha_user_auth.py` (N-4)
- `smplwise_vms/backend/tests/test_mfa_review_docs_2520.py` (new, 3 tests)

Train overlap: none of these files belongs to the WisKey R1-R7 / bridge 0.10.9 rows or DESIGN-LITERALS-2510 as far as their branches
show; `services/ha_user_auth.py` is a shared hot file (8 lines changed in the bearer sign-in tail).

## 3. Tests (real runs)

Workstation (Windows), the main checkout's `.venv` (imports this worktree's `smplwise`), `SW_WIRE_STRICT=1`, `-o addopts=""`, ONE
pytest process per file, run one after another:

| File | Exit | Result |
|---|---|---|
| `tests/test_mfa_review_docs_2520.py` (new) | 0 | **3 passed** (68 s) |
| `tests/test_mfa_reset_hardening_2510.py` (N-3 neighbourhood) | 0 | **22 passed** (300 s) |
| `tests/test_local_passkeys.py` (N-2 route) | 0 | **73 passed** (708 s) |
| `tests/test_mfa_policy_2490.py` (N-4 bearer path) | 0 | **70 passed** (279 s) |
| `tests/test_mfa_tokens_2490.py` (bearer step-up proofs) | 0 | **22 passed** (295 s) |
| `tests/test_mfa_secreview_2500.py` (the earlier review's SR tests) | 0 | **8 passed** (110 s) |
| `tests/test_mfa_secfix_2500.py` | 0 | **17 passed** (207 s) |

Red-before check: the new file run against `origin/main` code (the three source files stashed, the test kept): **3 failed** - N-2
answered 200 (the remote removal went through under `local`), N-3 `AttributeError` (no `sign_in_factor`; the old `signs_in_remotely`
counted the passkey), N-4 a `sign_in` mark for `u-mfa` was found. With the fixes: 3 passed.

Other checks: `ruff check` on the three changed source files and the new test file - **All checks passed** (exit 0).
`py -3.12 scripts/build_guide.py --check` - exit 0 ("GUIDE_ALL_HE.html is up to date").

NOT_RUN: any runner / slot-B job (the targeted files above were run on the workstation one at a time instead); the backend families
beyond the files listed; tsc / eslint / Playwright (no frontend change); any lab or real-device check (no real authenticator app,
passkey or phone).

## 4. Open questions (recommendation first)

1. **N-1 - adding a factor next to an existing one while step-up is off.** (a) the same re-sign-in rule as the first factor (a sign-in of
   this session within 5 minutes, remote channel only; a re-sign-in, not a code prompt) for every factor ADD, plus a user notice for a
   new recovery batch [recommended; row MFA-FACTOR-ADD-FRESH-2520]; (b) leave as is and recommend switching step-up on in the guide
   (what the guide says today).
2. **N-5 - an administrator with no factor resetting others.** (a) ask that administrator for a sign-in within 5 minutes on the remote
   channel [recommended]; (b) refuse a remote reset until the administrator has a factor; (c) leave (recorded residual).
3. **N-6 - notices.** (a) one content-free notice to the account's own user for a removed factor, a new recovery batch and a
   recovery-code sign-in [recommended]; (b) audit only (today).
4. **The English guide folder.** (a) keep `docs/user-guide/en/` for the pages that get an English edition, starting with this one
   [built]; (b) put English sections inside the Hebrew page.
