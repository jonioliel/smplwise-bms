# MFA-PASSKEY-ADMIN-REMOVE-2520 - an administrator's removal of an Arx-only identity's passkey meets the factor reset's rules

Branch `pilot/MFA-PASSKEY-ADMIN-REMOVE-2520`, base `origin/pilot/MFA-FACTOR-HARDEN-2520` (`eeb4bab89`). Spec: finding N-2 of
`docs/security/MFA-REVIEW-2520.md`, the rest of it (the channel part was fixed by MFA-REVIEW-DOCS-2520, the fresh sign-in by
MFA-FACTOR-HARDEN-2520 N-5). No version bump, no changelog entry, no tag, no lab / Home Assistant / NVR / go2rtc contact.

## 1. What and why

`DELETE identity/local-users/{id}/passkeys/{pk}` removes one of another user's authentication methods - a reset in effect - but only
the factor reset (`DELETE auth/second-factor/users/{id}`) had the MFA-RESET-HARDENING-2510 rules. Now the removal goes through the
SAME code paths (`services/factor_reset.py`), in the reset's order, each refusal audited (`identity.local.user.passkey_removed`,
denied, the reason; never the typed text or a code), all before the administrator's proof is read:

| Rule | How | Refusal |
|---|---|---|
| never oneself | `user_id == principal.user_id` | 409 `second_factor_self_reset` |
| the channel setting (already, MFA-REVIEW-DOCS-2520) | `factor_reset.channel_refuses` | 403 `factor_reset_local_only` |
| fresh sign-in from outside (already, MFA-FACTOR-HARDEN-2520) | `factor_reset.reauth_refuses` | 403 `reauth_required` |
| the typed username (`{"confirm"}`) | `factor_reset.confirm_text` / `confirm_matches` (NFC, trim, case) | 422 `factor_reset_confirm_required` / `_mismatch` |
| the last administrator who can sign in remotely | `factor_reset.passkey_last_admin_blocks` = `last_admin_blocks` when this passkey is the user's LAST sign-in factor | 409 `factor_reset_last_admin` |
| 3 per administrator per hour, ONE budget with the reset | `factor_reset.RATE_ACTIONS` (`resets_in_window` counts both allowed audit actions) | 429 `factor_reset_rate_limited` |

After the removal: the user is told (N-6, unchanged), **the managers are told** (`security.second_factor_reset_by_admin`, the reset's
content-free notice: the channel only), and when the removed passkey was the user's last sign-in factor (no authenticator code, no
other usable passkey - `factor_reset.passkey_removal_leaves_no_factor`) `must_enroll` is set (as after a reset; any new factor clears it)
and the user's step-up proofs end. The allowed audit row adds `must_enroll`, `managers_notified`, `reset_channel`, `resets_left`.

New preflight `GET identity/local-users/{id}/passkeys/{pk}/remove-check` (`identity.local.manage`, reads only): the reset's preflight
`factor_reset.check(..., passkey_id=...)` - same refusal order, `factors` = that one passkey, `must_enroll_after` only for the last
factor, the removal's own once-action (`auth.local.passkey.removed`). Answer model: the reset's `FactorResetCheck` (reused).
`UserPasskeyRemoved` gains `must_enroll` and `resets_left` (additive, ADR-015). The request body gains `confirm` (`extra=forbid` kept).

UI (Settings > Users and permissions > Arx users > a user): "Remove passkey" no longer opens the shared confirm sheet. It reads the
preflight and opens a box under that passkey built from the reset dialog's module (`components/factor-reset-confirm.ts`, unchanged):
the refusal in the reader's language (no remove button), what goes, the typed username (the remove button waits for an exact match),
the administrator's own code when they have the authenticator (from the preflight's `step_up.methods`, and still after a 403), remove /
cancel, and the server's refusal inside the box (`reauth_required` keeps the existing `passkeyReauth` text). Hebrew + English (the
texts are the existing `mfa` and `local-identity` catalogue entries; no new strings). Guide (he + en, `82-second-factor`): the removal
follows the reset's rules and counts against its budget; `GUIDE_ALL_HE.html` rebuilt.

Two rules are structurally unreachable today and are wired for defence in depth (tested by forcing them): **self** -
`identity.local.manage` is system-administrator-only and never delegable (`services/rbac_admin.py`), and the target must be an Arx-only
identity, which never holds it; **last administrator** - an Arx-only identity is never a system administrator (`rbac.is_system_admin`).
The review's remark that "a delegated identity manager may hold `identity.local.manage`" does not match the code (see question 3).

Not built (review proposal, deliberately left out): the 404-from-outside for an administrative target that `PUT .../passkey-only` has.
The owner's Q53 lets an administrator reset another user's factors from any channel, and the reset itself has no such rule; the channel
setting `local` already gives the owner that choice for both routes. See question 1.

## 2. Files

- Backend: `smplwise/services/factor_reset.py` (`PASSKEY_ACTION`, `PASSKEY_ONCE_ACTION`, `RATE_ACTIONS`, the shared count,
  `passkey_removal_leaves_no_factor`, `passkey_last_admin_blocks`, `check(..., passkey_id=)`), `smplwise/routers/local_passkeys.py`
  (`AdminRemoveBody`, `_remove_refused`, `admin_remove_check`, `admin_remove`), `smplwise/wire/local_passkeys.py`
  (`UserPasskeyRemoved`: `must_enroll`, `resets_left`).
- Frontend: `api/generated/wire-local-passkeys.ts` (generated), `api/passkeys.ts` (`adminRemovePasskeyCheck`, `adminRemovePasskey`
  sends `{confirm}`), `screens/system-local-users.ts`.
- Tests: `smplwise_vms/backend/tests/test_mfa_passkey_admin_remove_2520.py` (new, 15); the typed username added to the existing callers
  in `test_local_passkeys.py`, `test_passkey_only.py`, `test_mfa_review_docs_2520.py`, `test_mfa_factor_harden_2520.py`;
  `frontend/tests/evidence-mfa-passkey-admin-remove-2520.spec.ts` (new).
- Docs: this note, `docs/user-guide/he/82-second-factor_HE.md`, `docs/user-guide/en/82-second-factor_EN.md`,
  `docs/user-guide/he/GUIDE_ALL_HE.html` (generated).

Overlaps. MFA-RESET-CHANNEL-UI-2520 (from `release/2520-train`): no shared file at the time of writing - this row does not touch
`sw-factor-policy-admin.ts`, the step-up dialog, `components/factor-reset-confirm.ts` or `i18n/.../msg/mfa.ts`. If that row edits the
"from where" paragraph of `82-second-factor_*.md`, the lines are near this row's (the "3 per hour" line, the new paragraph after step 5)
but not the same; `GUIDE_ALL_HE.html` is generated - rebuild it at the merge (`scripts/build_guide.py`). `release/2520-train` already
contains this row's base; since then it changed only `GUIDE_ALL_HE.html` of this row's files (same rebuild). WisKey R1-R7, bridge 0.10.9,
DESIGN-LITERALS-2510: no shared file seen. `contracts/API_INVENTORY.md` is not regenerated here (the release does it).

## 3. Tests (real runs)

Backend - workstation (Windows), the main checkout's `.venv` (imports this worktree's `smplwise`), `SW_WIRE_STRICT=1`,
`-o addopts=""`, ONE pytest process per file, one after another:

| File | Exit | Result |
|---|---|---|
| `tests/test_mfa_passkey_admin_remove_2520.py` (new) | 0 | **15 passed** (209 s) |
| `tests/test_mfa_review_docs_2520.py` | 0 | **3 passed** |
| `tests/test_mfa_factor_harden_2520.py` | 0 | **17 passed** |
| `tests/test_mfa_reset_hardening_2510.py` | 0 | **22 passed** |
| `tests/test_passkey_only.py` | 0 | **10 passed** |
| `tests/test_wire_local_passkeys_2470.py` | 0 | **3 passed** |
| `tests/test_mfa_stepup_gates_2490.py` | 0 | **19 passed** |
| `tests/test_get_routes_read_conn.py` | 124 | timed out on the workstation (2400 s, busy PC) - run on the runner instead (below, passed) |

The workstation was too slow for the rest; I stopped that run and moved the remaining files to the runner.

Red-before: the new file run against the base `eeb4bab89` (runner, the file copied in): **14 failed, 1 passed** - the one that passes
is the unchanged refusal of an unknown body field; `test_permission_and_unknown_passkey_come_first` fails on the base only because
`factor_reset.PASSKEY_ACTION` does not exist there.

Backend - the Linux runner (slot B, `--basetemp` per shard), `SW_WIRE_STRICT=1`, branch head `b3334496d` / `d31a9d10d` (the later
commit changes only the frontend spec):

| Shard | Exit | Result |
|---|---|---|
| `test_mfa_passkey_admin_remove_2520` + `test_local_identity` | 0 | **56 passed** |
| `test_remote_access`, `test_security_review_220`, `test_routers_table_2440`, `test_route_char_2460`, `test_wire_routers_d_2470`, `test_wire_routers_b_2450` | 0 | **351 passed** |
| `test_mfa_stepup_2490`, `test_second_factor_followups`, `test_mfa_screens_2510`, `test_async_routes_hold_no_write_conn`, `test_error_envelope_family2_2500`, `test_capabilities` | 0 | **51 passed** |
| `test_get_routes_read_conn`, `test_local_auth_inventory`, `test_remote_hardening`, `test_wire_consumption_2450` (runs `gen_wire_types.py --check`), `test_wire_routers_c_2470` | 0 | **849 passed** |
| `test_mfa_secfix_2500`, `test_mfa_secreview_2500`, `test_mfa_policy_2490`, `test_mfa_tokens_2490`, `test_mfa_recovery_codes_2490` | 0 | **138 passed** |
| `test_mfa_devicekey_2490`, `test_mfa_passkeys_2490`, `test_second_factor`, `test_notify_sources`, `test_capture_lease_triggers` | 0 | **119 passed** |
| `test_local_passkeys`, `test_bill_ledger_lifecycle_b`, `test_i18n_backend_2490b`, `test_notify_core`, `test_notify_payload_golden` | 0 | **140 passed** |

Every MFA backend file named in `docs/changes/MFA-FACTOR-HARDEN-2520.md` section 3 was run (workstation or runner).

Other checks: `ruff check` on the 3 changed source files and the 5 changed / new test files (workstation) - **All checks passed**,
except the 10 `F811` of `tests/test_passkey_only.py`, which the base has too (the fixture import; only one line changed here);
`ruff check smplwise` (runner) - **All checks passed**. `scripts/gen_wire_types.py` regenerated the one file; `--check` exit 0.
`scripts/design_ratchet.py` - no count above the baseline (exit 0). `scripts/build_guide.py --check` - exit 0.

Frontend - the Linux runner (slot B):

| Check | Exit | Result |
|---|---|---|
| `npx tsc --noEmit -p .` / `-p tsconfig.tests.json` | 0 / 0 | clean / clean |
| `npx eslint` on the 3 changed source files + the new spec | 0 | 0 errors (1 "file ignored" warning for tests/) |
| `lazy-tags-check`, `unused-exports --enforce`, `i18n-split-langs --dry` | 0 | OK |
| `npm run build` | 0 | - |
| `evidence-mfa-passkey-admin-remove-2520.spec.ts` (new), desktop + mobile, preview build | 0 | **12 passed** (at `d31a9d10d`; at `b3334496d` the own-code case failed - the test typed 7 characters into a 6-character field; fixed in the spec) |
| `evidence-confirm-dialog-2438`, `evidence-access-polish-2331`, `evidence-mfa-factor-harden-2520`, `evidence-second-factor`, `evidence-mfa-screens-2510` (desktop + mobile) | 1 | all passed except 2 tests of `evidence-mfa-screens-2510` "my account › security" (the phone keys list, a screen this row does not touch): re-run on this row AND on the base build `eeb4bab89` - the same test (`:88`, a cancelled step-up keeps the key) fails on both, the other passed on the re-run: not this row (flaky / pre-existing) |
| `pixel-mfa-screens-2510.spec.ts` (Linux baselines, NOT updated) | 0 | **6 passed** - no pixel spec covers the Arx users screen, so there was no baseline to refresh |
| unit pages on `http://localhost` (`SW_UNIT_PAGES=1`): `unit-second-factor-admin-ui`, `unit-mfa-passkeys-2490`, `unit-local-user-create-2438` | 0 | **7 passed** |

Compare page (Hebrew, local): `private/planning/mfa-passkey-admin-remove-2520_compare_2026-11-25.html` - "Remove passkey" before (the
shared confirm sheet, base build `eeb4bab89`, same mocks) and after (the box), and the preflight's refusal (after only), Hebrew + English,
desktop + phone, light + dark.

NOT_RUN: any lab or real-device check (no real passkey, authenticator app or phone); the Android app (not in this repository); the
full backend suite beyond the files listed.

## 4. Open questions (recommendation first)

1. **An administrative target from outside.** The review proposed the `passkey-only` route's rule: removing the passkey of an Arx-only
   identity that holds an administrative permission answers 404 from outside. (a) not built - the removal follows the reset, which the
   owner allowed from any channel (Q53); the owner's channel setting `local` covers both [recommended]; (b) build the 404 for this route
   only.
2. **The managers' notice wording.** The removal reuses the reset's source `security.second_factor_reset_by_admin` (content-free: "an
   administrator reset a user's sign-in methods", the channel). (a) keep one source - one switch in the notification settings covers
   both [recommended]; (b) a source of its own ("an administrator removed a user's passkey").
3. **The review's text on who may remove.** N-2 says a delegated identity manager may hold `identity.local.manage`; the code makes it
   system-administrator-only and never delegable. (a) correct the review's sentence in the next review pass [recommended]; (b) leave it.
4. **Older clients.** A DELETE without `confirm` is now 422 (as the reset became in 2.51). The web screen sends it; the Android app is
   not in this repository. (a) accept - the app has no administrator passkey screen as far as this repository shows [recommended];
   (b) accept a missing `confirm` from the app for one release.
