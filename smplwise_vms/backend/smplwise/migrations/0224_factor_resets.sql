-- MFA-RESET-HARDENING-2510 (MFA-STEPUP-TRAIN-2490 slice 10; owner decision Q53, 2026-11-22: an administrator resets another user's
-- authentication methods from any channel, with the administrator's own approval). Additive only: the previous version ignores the
-- table (rollback = the forced re-enrolment after an administrator's reset simply stops; the reset itself is unchanged).
-- Number 0224: the train ends at 0223 (slice 9, device-key attestation); 0217 / 0218 are the 2.50 rows. RENUMBER AT MERGE only if the
-- order changed.

-- One row per user whose factors an administrator reset (services/factor_reset.py). must_enroll = 1 until the user enrols a factor again
-- (the code, a passkey or a phone key); while it is set and the factor policy requires a factor, the user's next remote sign-in goes to
-- enrolment. Who reset and when are in the audit row too (`auth.second_factor.reset`). Never in a backup
-- (services/backup.NEVER_EXPORTED_TABLES): it is runtime security state of THIS installation, like the factors themselves.
CREATE TABLE IF NOT EXISTS auth_factor_resets (
  user_id      TEXT PRIMARY KEY,
  reset_at     TEXT NOT NULL,
  reset_by     TEXT,
  must_enroll  INTEGER NOT NULL DEFAULT 1
);
