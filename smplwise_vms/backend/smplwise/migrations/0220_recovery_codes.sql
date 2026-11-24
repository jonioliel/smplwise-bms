-- MFA-RECOVERY-CODES-2490 (MFA-STEPUP-TRAIN-2490 slice 7; owner decision Q49, 2026-11-22: 10 recovery codes per user, each usable once).
-- Additive only: the previous version ignores the table (rollback = the codes simply stop working; the authenticator code is unchanged).
-- Number 0220 (the lead's train allocation, 2026-11-24): main ends at 0216; 0217 / 0218 are the 2.50 rows (camera discovery origin,
-- multi-building home), 0219 is slice 6 (TOKENS), 0221 slice 5 (POLICY), 0222 slice 8 (DEVICEKEY). RENUMBER AT MERGE only if the order changed.

-- One row per code. Only a scrypt PHC hash of the canonical code is stored (services/local_passwords.py, a lighter profile than the
-- passwords: a code carries 40 random bits and is never chosen by a person); the code itself is shown once, at generation, and never
-- again. batch_id groups the codes of one generation: a new batch deletes the user's previous rows, so an old code stops working at
-- once. used_at marks a spent code (kept until the next batch for the remaining count); used_for says where it was spent
-- (sign_in | local_sign_in | step_up | disable). Never in a backup (services/backup.NEVER_EXPORTED_TABLES).
CREATE TABLE IF NOT EXISTS auth_recovery_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  batch_id    TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  used_at     TEXT,
  used_for    TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_recovery_codes_user ON auth_recovery_codes (user_id, used_at);
