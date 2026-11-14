-- K11 first slice (docs/changes/CR-011-SECOND-FACTOR.md, owner decisions 2026-10-06): the optional TOTP second factor
-- (RFC 6238, works with Google Authenticator) for the remote sign-in. Additive only: the table is ignored by the
-- previous version (rollback = run it; enrolled users then simply sign in without a code).
-- Number 0065: 0064 is Frigate F1 and 0066 Frigate F2 on other branches; RENUMBER AT MERGE only if the order changed.

-- One row per user (an HA user id or a local user id, the same id the principal carries). The secret is stored ENCRYPTED
-- (AES-256-GCM, the key file and helpers of services/alarm_codes.py; the associated data binds it to the user id) and
-- never leaves the server after the enrolment answer. enabled = 0: a secret was issued but its first code was not yet
-- confirmed (the row does not gate any sign-in); enabled = 1: the factor is active. last_step is the last accepted
-- 30-second time step, so one code cannot be used twice.
CREATE TABLE auth_totp (
  user_id      TEXT PRIMARY KEY,
  secret_ct    TEXT NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  enabled_at   TEXT,
  last_used_at TEXT,
  last_step    INTEGER NOT NULL DEFAULT 0
);
