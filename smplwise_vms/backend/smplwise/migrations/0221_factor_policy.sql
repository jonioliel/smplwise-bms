-- MFA-POLICY-2490 (slice 5 of the second-factor train, branch pilot/MFA-POLICY-2490 from pilot/MFA-STEPUP-2490; design
-- docs/design/full-2fa-t095/DESIGN.md 4.1 / 6). Number 0221 by the train's plan (0219 tokens, 0220 recovery / passkeys, 0222 device
-- keys); RENUMBER AT MERGE only if the order changed - the content does not depend on it. Additive only.
-- Rollback: the previous version ignores both tables (it reads auth_totp_policy, which is unchanged and kept in step by the code).

-- The sign-in factor policy's per-user / per-role overrides (services/factor_policy). A missing row = inherit. `required` = a remote
-- sign-in owes a factor; `optional` = never owed by this policy; `exempt` = never owed by this policy and counted as exempt in the
-- compliance view (the owner's wall-tablet answer q29). Seeded from the legacy TFA2 table; both routes mirror their writes into both
-- tables (`exempt` is `optional` in the legacy one). subject_id is a user id or a role id (built-in or custom). Not a backup table
-- (auth_totp_policy never was): a restore cannot change who must show a factor.
CREATE TABLE auth_factor_policy (
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('user', 'role')),
  subject_id   TEXT NOT NULL,
  sign_in      TEXT NOT NULL CHECK (sign_in IN ('required', 'optional', 'exempt')),
  updated_at   TEXT NOT NULL,
  updated_by   TEXT,
  PRIMARY KEY (subject_kind, subject_id)
);
INSERT INTO auth_factor_policy(subject_kind, subject_id, sign_in, updated_at, updated_by)
  SELECT subject_kind, subject_id, policy, updated_at, updated_by FROM auth_totp_policy;

-- HA MFA provenance (services/mfa_provenance): when Arx FIRST saw Home Assistant report an enabled MFA module for the user (and when
-- last), from the validations it makes anyway. Deleted as soon as HA reports none, so MFA switched off and on again starts a fresh
-- first_seen_at - a sign-in older than first_seen_at never counts as an MFA sign-in. modules_json: the module ids only (e.g. ["totp"]).
-- No token, no refresh-token id, no code. Runtime state of THIS box: not a backup table (the archive is an allow-list).
CREATE TABLE auth_mfa_seen (
  user_id       TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  modules_json  TEXT NOT NULL DEFAULT '[]'
);
