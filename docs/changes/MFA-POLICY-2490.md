# MFA-POLICY-2490 - the sign-in factor policy, HA MFA provenance and the compliance view (slice 5 of the second-factor train)

Branch `pilot/MFA-POLICY-2490`, cut from `origin/pilot/MFA-STEPUP-2490` (slice 1, `fb9a3ac1e`). Train plan:
`docs/changes/MFA-STEPUP-TRAIN-2490.md` section 4 row 5. Design: `docs/design/full-2fa-t095/DESIGN.md` (on
`origin/pilot/FEATURE-DESIGNS-SEC-2490`) sections 4.1, 6, 7, 9, 10. No UI (the screens are slice 11), no version bump, no changelog
entry, no lab / Home Assistant / NVR / go2rtc contact. Fakes only.

## 1. Owner decisions applied

| Source | Decision | Here |
|---|---|---|
| Owner answer for this slice (built to the recommendation) | A user without a factor is ALLOWED until this policy is switched on; the policy default must not lock anyone out on upgrade. | `security.factor_policy = optional` and `security.factor_policy_mode = report` by default: the policy is evaluated and shown, never refuses. The legacy rules act exactly as before in every mode. |
| Q48 (2026-11-22) | A long-lived token from outside stays allowed. | `security.remote_long_lived_tokens = allow` by default; with `allow` no extra HA call is made. The stricter values stay selectable. |
| q29 א (06.10) | Wall tablets are exempt. | `security.factor_wall_exempt = on` by default. |
| owner 18.10 | The service identity is never asked for a second factor. | Always `exempt` (source `service`). |

## 2. What this slice adds

### 2.1 Settings (`services/settings_store.DEFAULTS`, `PATCH /settings`, in `backup.SETTINGS_KEEP` - a restore never changes them)

| Key | Values | Default |
|---|---|---|
| `security.factor_policy` | `optional` (nobody by this policy) \| `admins` (holders of an administrative permission) \| `sensitive` (administrative permissions, every step-up gated permission, `alarm.disarm`, `alarm.bypass`, `access.doors.open`, `access.release`, `access.emergency.open`) \| `all` | `optional` |
| `security.factor_policy_mode` | `report` \| `enforce` | `report` |
| `security.factor_wall_exempt` | `on` \| `off` | `on` |
| `security.remote_long_lived_tokens` | `allow` \| `refuse_under_policy` \| `refuse` | `allow` |

Changing them needs `system.configure` and therefore (slice 1) a fresh step-up proof on the remote channel; the generic
`settings.update` audit row records the change.

### 2.2 Resolution (`services/factor_policy.resolve`)

The service identity -> the user's own override -> any role `required` -> a wall-panel user (enabled profile, switch on) -> any role
`optional` / `exempt` -> the global policy. Answer: `required` / `optional` / `exempt` with its source (`service`, `user`, `role`,
`wall`, `global`).

Hook: `second_factor.effective_policy` (the one place every sign-in path asks - remote cookie exchange, bearer, Arx-only identities,
app WebView sessions) is now the legacy rule (`second_factor.legacy_policy`, unchanged) plus this policy **only in `enforce` mode**:
`required` when the legacy rule requires it OR this policy does (never weaker than today); the new source word is `policy`. An
exemption here exempts from this policy only - except user / role overrides, which are mirrored into the legacy table (below).

### 2.3 Overrides (`auth_factor_policy`, migration 0221)

`required` / `optional` / `exempt` per user and per role, seeded from `auth_totp_policy`. Both routes mirror their writes into both
tables (`exempt` is `optional` in the legacy table, `inherit` deletes the row), so the two layers never disagree about a person or a
role. Neither table is in a backup (the legacy one never was).

### 2.4 HA MFA with provenance (`services/mfa_provenance.py`, `auth_mfa_seen`)

A user whom ONLY the enforced policy requires and who has no Arx factor may satisfy it with Home Assistant's own MFA, proven by:

1. `auth/current_user` lists an enabled MFA module (asked by every validation already; `HaUser.mfa_modules` now carries the ids);
2. `auth/refresh_tokens` (read-only, with the user's own token) lists the token's refresh token (`iss`) with `type = normal`,
   `client_id` = this Arx address (the same `arx_client_id` the sign-out path compares), `auth_provider_type = homeassistant`, and
   `created_at` not earlier than `auth_mfa_seen.first_seen_at`.

`auth_mfa_seen` is written by `observe()` from the validations Arx makes anyway (the exchange, a new bearer sign-in, the background
re-validation pass), throttled to one write per user per hour unless the state changes; a row is deleted as soon as HA reports no
enabled module, so a token created while MFA was off never counts. `first_seen_at` has microsecond precision.

Verdict reasons: `ok`, `no_ha_mfa`, `no_mfa_seen`, `no_iss`, `shape_unknown` (drift - never a pass), `not_found`, `long_lived`,
`not_normal`, `other_client`, `other_provider`, `before_mfa_seen`. The reason is audited (`details.provenance`) and returned in
`details.provenance` of the 403; never a token, a refresh-token id or a code.

Sign-in behaviour (`ha_user_auth.second_factor_need` answers the new value `ha_mfa` for this case):

- cookie exchange and new bearer sign-in: provenance ok -> session (audit `second_factor: "ha_mfa"`); not ok -> 403
  `second_factor_enrollment_required` (for `before_mfa_seen` the message says to sign out and in again - the next sign-in passes);
  HA unreachable -> 503 `ha_unavailable` (fail closed, design 9). HA is not asked at all when it reports no MFA.
- a user enrolled with the Arx authenticator code is still asked that code (today's behaviour); the legacy rules keep asking for the
  Arx factor (HA MFA does not satisfy `security.second_factor_policy = admins`).
- the bearer path marks the sign-in verified after a pass, so the next access token of the same HA sign-in is not re-checked.

### 2.5 Long-lived tokens (`security.remote_long_lived_tokens`)

`allow` (default): nothing changes, no HA call. `refuse`: a NEW remote sign-in (cookie exchange or bearer; not the rotation of the
caller's own live cookie session) with a long-lived token -> 403 `long_lived_token_refused`, audited reason `long_lived_token`.
`refuse_under_policy`: the same for users whom `effective_policy` requires a factor of (in `report` mode: only the legacy rules).
Long-lived = HA's refresh-token type says so; when the listing does not name it (drift), the token's own lifetime (`exp - iat` over
two days). Ingress is never affected. Arx never deletes or changes an HA token.

### 2.6 Routes (`routers/factor_policy.py`, wire `wire/factor_policy.py`, family `FactorPolicy`)

| Route | Who | Answer |
|---|---|---|
| `GET /security/factor-policy[?policy=optional\|admins\|sensitive\|all]` | `rbac.assign` or `system.configure` | `FactorPolicy {policy, mode, enforced, wall_exempt, long_lived_tokens, legacy {second_factor_policy, require_mfa_admin}, overrides, compliance}`; `compliance` = `{policy, users_total, covered, enrolled, missing_count, missing[], exempt_count, exempt[], ha_mfa_seen, legacy_required}` for the stored policy or the previewed `policy`; each person `{user_id, name, kind ha\|local, reason, factor totp\|passkey\|ha_mfa\|null}`; lists capped at 500 |
| `PUT /security/factor-policy/overrides/{kind}/{id} {sign_in}` | `system.configure` (+ step-up, slice 1 gate) | `OverrideSet`; audited `auth.factor_policy.changed {before, after, mode}`; rate-limited per user |

People of the compliance view: active `users` rows (not deleted / purged) plus active `ha_users`, minus anyone disabled on either side.
A factor is the Arx TOTP, a usable passkey (Arx-only users) or an `auth_mfa_seen` row (HA MFA seen; the sign-in still needs provenance).

## 3. Files

`smplwise/migrations/0221_factor_policy.sql` (new), `smplwise/services/factor_policy.py` (new), `smplwise/services/mfa_provenance.py`
(new), `smplwise/routers/factor_policy.py` (new), `smplwise/wire/factor_policy.py` (new), `smplwise/services/second_factor.py`
(`legacy_policy` split out, hook, legacy-route mirror), `smplwise/services/ha_user_auth.py` (`HaUser.mfa_modules`,
`second_factor_need` -> `ha_mfa`, `long_lived_check_needed`, `provenance_gate`, exchange + bearer wiring, observation in the exchange,
bearer and re-validation pass, test reset), `smplwise/routers/__init__.py` (mount), `smplwise/routers/settings.py`,
`smplwise/services/settings_store.py`, `smplwise/services/backup.py`, `scripts/gen_wire_types.py` (family),
`frontend/src/api/generated/wire-factor-policy.ts` and `contracts/API_INVENTORY.md` (regenerated), `tests/test_mfa_policy_2490.py` (new).

Migration number 0221 per the train plan (0219 tokens, 0220 recovery / passkeys, 0222 device keys). Checked on 2026-11-24: no
`origin/pilot/MFA-*` branch and neither `origin/main` nor `origin/release/2490-train` has a 0221 file. Note for the train: the
`MFA-TOKENS-2490` and `MFA-RECOVERY-2490` branches BOTH carry a `0219_*.sql` today; the plan's 0220 for recovery has to be applied at
integration.

## 4. Contradictions and limits (recorded, not resolved silently)

1. **Design default vs. the owner answer.** Design 6 says the default of `security.factor_policy` comes from the legacy keys
   (`security.second_factor_policy` / `remote.require_mfa_admin`), migrated, and the legacy keys become read-compatible for one
   version. Implemented instead: the new key starts at `optional` in `report` mode and the legacy keys keep acting unchanged (union in
   `enforce` mode). Reason: the owner's answer (no lockout on upgrade) and "never weaker than today" are both met without moving a
   value; the legacy keys can be retired in a later release once the screens show both.
2. **`report` mode is an addition to the design** (the design has the policy values only). It gives the owner the compliance preview
   on real data before anything bites (rollout step 4: "watches the compliance preview").
3. **The first sign-in after a user enables HA MFA fails provenance** when Arx has not observed MFA before that sign-in (the token's
   `created_at` is earlier than the first observation). Design 9 accepts it ("next sign-in does"); the refusal text tells the user to
   sign in again. The re-validation pass shortens the window for users with a live session.
4. **App WebView sessions** (`services/app_session._enrol_refused`) use `effective_policy` too: under an enforced policy an HA user
   without an Arx factor is refused there even with HA MFA (no provenance on that path). Stricter, never weaker; slice 8 (device key,
   Q51) is where the app's own second factor lands.
5. **Overrides set through the new route do not end live sessions** (the legacy `required` override ends the affected users' other
   remote sign-ins). Design 9: an enforced policy applies at the next remote sign-in; nobody is locked out mid-session.
6. **`security.factor_methods`** (design 6) is not built: the methods are what each path already accepts.
7. **The factor-policy settings are changeable from any channel** (with step-up). Design 6 suggests "local channel only unless
   noted"; the legacy `security.second_factor_policy` never was. Open question 5.3.

## 5. Open questions (recommendation first)

1. **Retire the legacy keys?** (a) keep them acting (union) until the screens slice shows both, then migrate in the next release
   [recommended]; (b) migrate their values into `security.factor_policy` now.
2. **HA MFA for the legacy `admins` rule.** (a) keep the legacy rule meaning "the Arx factor" [recommended: unchanged behaviour];
   (b) let HA MFA with provenance satisfy it too.
3. **Who may switch the policy off / to `report`.** (a) anyone with `system.configure` after a step-up, audited [recommended, same as
   step-up's own switch]; (b) the local channel only.
4. **The first-sign-in-after-enabling gap** (4.3). (a) keep fail-closed with the "sign in again" text [recommended, design 9];
   (b) also observe from the HA user directory sync if HA ever exposes the MFA state there.

## 6. Tests (real runs)

| Where | Command | Result |
|---|---|---|
| workstation (Windows, Python 3.12, one file at a time) | `pytest tests/test_mfa_policy_2490.py` | **70 passed** |
| workstation | `pytest tests/test_mfa_stepup_2490.py` | **22 passed** |
| workstation | `pytest tests/test_second_factor.py` | **23 passed** |
| workstation | `pytest tests/test_second_factor_followups.py` | **11 passed** |
| workstation | `pytest tests/test_remote_access.py` | **66 passed** |
| workstation | `pytest tests/test_wire_route_coverage_2460.py` / `test_routers_table_2440.py` | **5 passed** / **10 passed** |
| workstation | `pytest tests/test_wire_routers_d_2470.py` | 69 passed, **1 failed**: `test_the_generated_client_types_are_current` reports `wire-generator.ts` stale only when the whole file runs; alone it passes and `scripts/gen_wire_types.py --check` exits 0. Order-dependent, in the generator family this branch does not touch - not caused here (see the runner run). |
| workstation | `scripts/gen_wire_types.py --check` | exit 0 |
| runner slot B | auth / security / settings backend files (52 files, 4 shards) + `ruff check smplwise`, one combined job `~/work/mfapolicy_job.sh` | see below |
