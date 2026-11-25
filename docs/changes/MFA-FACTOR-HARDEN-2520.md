# MFA-FACTOR-HARDEN-2520 - a fresh sign-in for every factor added and every reset from outside; notices for factor changes

Branch `pilot/MFA-FACTOR-HARDEN-2520`, base `origin/pilot/MFA-REVIEW-DOCS-2520` (`284ac25ea`). Spec: findings N-1, N-5 and N-6 of
`docs/security/MFA-REVIEW-2520.md`, built to the review's recommendations, which the owner approved explicitly (25.11: "all three parts as
specified"). No version bump, no changelog entry, no tag, no lab / Home Assistant / NVR / go2rtc contact. One commit per part.

## 1. What and why

| Part | Commit | What changed |
|---|---|---|
| **N-1** | `142ec15fb` | With step-up off (the default) a factor ADDED next to an existing one asked nothing, so a stolen old session could plant a phone key, a passkey or a new batch of recovery codes. Now every factor add on the **remote channel** - the authenticator code next to another factor, a passkey, a phone key, a new recovery batch without the current code - gets exactly the FIRST factor's rule (MFA-SECFIX-2500 SR-3): a sign-in of this session within 5 minutes, else 403 `reauth_required` (details `{action, within_s: 300}`, audited as the first factor's refusal is). The local channel stays the break-glass path; with step-up on the proof applies exactly as before (a stale session with a fresh proof still adds); the current authenticator code in the body still mints a recovery batch (a proof of its own, as before); an Arx-only identity's passkey keeps its own fresh-sign-in rule (unchanged). |
| **N-5** | `2c6bf299a` | An administrator's reset of another user's factors from outside (`DELETE auth/second-factor/users/{id}`) and an administrator's removal of an Arx-only identity's passkey (`DELETE identity/local-users/{id}/passkeys/{pk}`) need a sign-in of the administrator's own session within 5 minutes (same mechanism, `factor_reset.reauth_refuses` -> `step_up.recent_sign_in`), checked right after the channel setting and before the typed username, the rate limit and the once-proof (which an administrator with a factor still gives). Refusal 403 `reauth_required`, audited (`auth.second_factor.reset` denied `reauth`; `identity.local.user.passkey_removed` denied `reauth_required`). The preflight `reset-check` answers `reason: "reauth"` (additive enum value; `frontend/src/api/generated/wire-second-factor.ts` regenerated). Applied to EVERY administrator, as the owner approved it ("an admin's reset ... from outside"), not only to one with no factor (the review's narrower variant) - see question 1. |
| **N-6** | `e4c8f1300` | New notice source `security.second_factor_changed` to the account's OWN user on every device (inbox, web push, the app - the policy of `security.second_factor_added`), content-free: only what happened. Sent when the authenticator is removed (`disable`), one's own passkey is removed (either kind of account), an administrator removes an Arx-only identity's passkey, one's own phone key is revoked, a new recovery batch is made (not the enrolment's first batch: that is "a factor was added"), and a sign-in is answered with a recovery code (both sign-in paths, through `recovery_codes.audit_use` - no change in `ha_user_auth.py` or `services/local_identity.py`). Never a code, a label, a key, an address or the actor (the audit row has them). The administrator's full reset keeps its own two notices. The policy is tunable like any source (Settings > Notifications). |
| tests + guide | `2f7bfce60`, `6600d701a` | See section 3; the Hebrew and English guide (`docs/user-guide/he|en/82-second-factor_*.md`): the fresh sign-in for every factor added and every reset from outside, the notices, the limits section rewritten; `GUIDE_ALL_HE.html` rebuilt. |

UI texts (Hebrew + English): the account security screen maps `reauth_required` to "a fresh sign-in (less than 5 minutes ago)" in the
reader's language (`secondFactor.reauth`) instead of the server's Hebrew-only text; the reset dialog shows reason `reauth` ("resetting
from outside needs a fresh sign-in") with no confirm button; the local users screen maps the passkey removal's `reauth_required` to the
existing `passkeyReauth` text. The phone key is added from the Android app, which already handles `reauth_required` for a first key.

Owner-decision fit: step-up stays OFF by default; the new rule is a re-sign-in, not a code prompt (as kept for the first factor); the
notices are a new behaviour the owner approved, and each can be switched off per source in the notification settings (default on).

## 2. Files

- Backend: `smplwise/services/step_up.py` (`reauth_error`, `require_recent_sign_in`, `require_first_factor_freshness`),
  `services/user_passkeys.py` (registration, 4 lines), `routers/second_factor.py` (recovery batch, reset, disable),
  `services/factor_reset.py` (`reauth_refuses`, the preflight), `wire/second_factor.py` (`reason` enum), `routers/local_passkeys.py`
  (admin removal: reauth + notice; own removal: notice), `routers/device_keys.py` (revoke notice), `services/notify_policy.py`,
  `services/notify_policy_text.py`, `services/notify_sources.py` (`second_factor_changed`, `FACTOR_CHANGES_HE`),
  `services/recovery_codes.py` (`SIGN_IN_USES`, the notice in `audit_use`).
- Frontend: `api/generated/wire-second-factor.ts` (generated), `components/sw-second-factor.ts`, `components/factor-reset-confirm.ts`,
  `screens/system-local-users.ts`, `i18n/he.ts`, `i18n/lang/en/i18n/en.ts`, `i18n/lang/en/i18n/msg/mfa.ts`.
- Tests: `smplwise_vms/backend/tests/test_mfa_factor_harden_2520.py` (new, 17), `tests/fixtures/bill_ledger_b_sql_golden.json` (the
  new policy row), `frontend/tests/evidence-mfa-factor-harden-2520.spec.ts` (new), `frontend/tests/mfa-screens-mocks.ts` (the type of
  `resetRefusal`).
- Docs: this note, `docs/user-guide/he/82-second-factor_HE.md`, `docs/user-guide/en/82-second-factor_EN.md`,
  `docs/user-guide/he/GUIDE_ALL_HE.html` (generated).

Overlaps. MFA-HA-PASSKEY-2520 (from main, in parallel): this branch does NOT touch `services/ha_user_auth.py` or
`services/local_passkeys.py`; `routers/local_passkeys.py` gets 10 lines (admin removal + own removal); both rows add lines to
`frontend/src/i18n/lang/en/i18n/msg/mfa.ts` at different places (no textual conflict expected). Semantics: their passkey sign-in for
Home Assistant users is not a recovery-code sign-in, so it sends no `second_factor_changed`; adding a passkey from outside follows this
row's N-1 rule either way. The 2.52 train rows (WisKey R1-R7, bridge 0.10.9, DESIGN-LITERALS-2510): no shared file seen.
`routers/second_factor.py` and `services/step_up.py` are MFA hot files.

## 3. Tests (real runs)

Backend - workstation (Windows), the main checkout's `.venv` (imports this worktree's `smplwise`), `SW_WIRE_STRICT=1`,
`-o addopts=""`, ONE pytest process per file, one after another (the MFA files of `docs/changes/MFA-REVIEW-DOCS-2520.md` first):

| File | Exit | Result |
|---|---|---|
| `tests/test_mfa_factor_harden_2520.py` (new) | 0 | **17 passed** (171 s) |
| `tests/test_mfa_review_docs_2520.py` | 0 | **3 passed** |
| `tests/test_mfa_secfix_2500.py` | 0 | **17 passed** |
| `tests/test_mfa_secreview_2500.py` | 0 | **8 passed** |
| `tests/test_mfa_reset_hardening_2510.py` | 0 | **22 passed** (302 s) |
| `tests/test_local_passkeys.py` | 0 | **73 passed** (762 s) |
| `tests/test_mfa_policy_2490.py` | 0 | **70 passed** |
| `tests/test_mfa_tokens_2490.py` | 0 | **22 passed** |
| `tests/test_mfa_recovery_codes_2490.py` | 0 | **21 passed** |
| `tests/test_mfa_devicekey_2490.py` | 0 | **19 passed** |
| `tests/test_mfa_passkeys_2490.py` | 0 | **26 passed** |
| `tests/test_second_factor.py` | 0 | **23 passed** |
| `tests/test_bill_ledger_lifecycle_b.py` (the golden policy list) | 0 | **25 passed** |
| `tests/test_i18n_backend_2490b.py` (source labels in English) | 0 | **13 passed** |
| `tests/test_notify_sources.py` | 0 | **37 passed** |
| `tests/test_notify_core.py` | 0 | **27 passed** |
| `tests/test_notify_payload_golden.py` | 0 | **2 passed** |
| `tests/test_wire_consumption_2450.py` (runs `gen_wire_types.py --check`) | 0 | **13 passed** |
| `tests/test_wire_routers_c_2470.py` | 0 | **58 passed** |

Red-before: the new file run against the base `284ac25ea` (a separate worktree, the test file copied in): **12 failed, 5 passed** -
every N-1 / N-5 / N-6 assertion fails on the old code; the 5 that pass are the unchanged behaviours (a fresh session adds, the local
channel, step-up on with a proof, a fresh administrator with a factor still owes the once-proof, the local reset).

Other checks: `ruff check` on the 11 changed source files and the new test file - **All checks passed** (exit 0).
`scripts/design_ratchet.py` - no count above the baseline (exit 0). `scripts/gen_wire_types.py` regenerated the one file.
`scripts/build_guide.py --check` - exit 0 ("GUIDE_ALL_HE.html is up to date").

Frontend - the Linux runner (slot B), worktree at `6600d701a`. The later spec commit `d4986953a` only adds the app's own scheme choice for
the "dark" pictures (they had come out light); it was queued on the runner but not reached (slot B busy) and was cancelled - NOT_RUN
at that commit; the assertions it runs are those that passed at `6600d701a`.

| Check | Exit | Result |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` | 0 | clean |
| `npm run typecheck` (tests + scripts) | 0 | clean |
| `npx eslint` on the 8 changed .ts files | 0 | 0 errors (2 "file ignored" warnings for tests/) |
| `scripts/design_ratchet.py` | 0 | no count above the baseline |
| `scripts/gen_wire_types.py --check` | 0 | up to date |
| unit suite `playwright.unit.config.ts --workers=2` (node-only) | 1 | **5233 passed, 15 skipped, 3 failed** - the 3 are `unit-mfa-passkeys-2490.spec.ts` (lines 202 / 259 / 285), a page spec that has no base URL in the node-only run; the same 3 fail on the I18N-REST-2520 branch's run from main (`~/work/i18nrest_fe.log`), so not this row. Page mode: below. |
| `npm run build` | 0 | - |
| `evidence-mfa-factor-harden-2520.spec.ts` (new), desktop + mobile, light and dark, `http://localhost:4393/` | 0 | **8 passed** each run |
| `evidence-mfa-screens-2510`, `unit-second-factor-admin-ui`, `evidence-second-factor`, `evidence-local-user-create-2438` (desktop + mobile) | 0 | **46 passed, 5 skipped** |
| `pixel-mfa-screens-2510.spec.ts` (Linux baselines, NOT updated) | 0 | **6 passed, 3 skipped** - no baseline changes needed: the normal states of the changed screens are untouched |

NOT_RUN: `unit-mfa-passkeys-2490.spec.ts` in page mode (`SW_UNIT_PAGES=1`, localhost) - queued with the pictures job and cancelled
(slot B busy). This row does not touch `sw-passkeys` or the passkey mocks; the spec's 3 failures in the node-only run are the same on a
branch from main.

Compare page (Hebrew, local): `private/planning/mfa-factor-harden-2520_compare_2026-11-25.html` - the two new states (the reset's
"sign in again" refusal, the enrolment's fresh-sign-in message), Hebrew + English, desktop + phone, before (base
`284ac25ea` build with the same mocks) and after - light only: the "dark" pictures of the run came out light (the app follows its own
scheme setting, not the OS) and the re-run with the fix was not reached on the runner.

NOT_RUN: the backend families beyond the files listed; any lab or real-device check (no real authenticator app, passkey or phone);
the Android app's handling of `reauth_required` for a SECOND phone key (the app is not in this repository - it already gets the same
answer for a first key).

## 4. Open questions (recommendation first)

1. **N-5 for an administrator who HAS a factor.** Built as approved: from outside, every administrator needs a sign-in within 5 minutes
   before a reset, on top of the once-proof. (a) keep it for everyone [recommended - a reset is rare, and it is what was approved];
   (b) ask it only of an administrator with no factor (the review's narrower variant; one with a factor gives a code anyway).
2. **The notice for an administrator's removal of an Arx-only identity's passkey.** (a) the identity is told (built) and the managers'
   notice stays for the proposed row MFA-PASSKEY-ADMIN-REMOVE-2520 [recommended]; (b) tell the managers now too.
3. **A recovery code used for step-up or to remove the authenticator.** (a) no separate notice: the removal sends its own, a step-up proof
   is the user's own session [recommended, built]; (b) a notice for every recovery-code use.
