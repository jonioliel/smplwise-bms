-- USR2-P2B (owner decision 2026-10-16, option b): the self-service password-reset codes and their send counters are PERSISTENT
-- across add-on restarts (services/local_reset.py; docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md section 8).
-- Provisional number 0102 (the lead renumbers at integration; contiguous sequence rule). Additive only: two new tables and
-- triggers that only delete rows of these tables. Nothing here is written while `security.local_identity` is `off`.
--
-- Never stored: the code, the phone number, the username. The code is kept only as HMAC-SHA256 under a key derived from the
-- messaging key FILE (<data>/secrets/messaging_key - never in the database, never in a backup), bound to the code id, the user id,
-- the credential row (password hash + set_at) and the number key; the number only as a keyed hash (same derived key). A copy of
-- the database alone therefore cannot brute-force a 6-digit code or a phone number.
-- Neither table is a backup table (services/backup.py NEVER_EXPORTED_TABLES): never written to an archive, never restored.

CREATE TABLE auth_local_reset_codes (               -- one live code per user (a new request replaces the row)
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_id            TEXT NOT NULL,                 -- 32 random hex characters; the audit shows its first 12
  code_mac           TEXT NOT NULL,                 -- HMAC-SHA256(derived key, 'lr' | code id | user id | credential fingerprint | number key | code)
  number_key         TEXT NOT NULL,                 -- keyed hash of the verified number the code was sent to (never the number)
  created_at         REAL NOT NULL,                 -- epoch seconds
  expires_at         REAL NOT NULL,                 -- created_at + 10 minutes
  attempts           INTEGER NOT NULL DEFAULT 0,    -- wrong guesses used (5 end the code)
  consumed           INTEGER NOT NULL DEFAULT 0 CHECK (consumed IN (0, 1))  -- single use: UPDATE ... WHERE consumed = 0 (rowcount 1 wins)
);
CREATE INDEX idx_auth_local_reset_codes_expires ON auth_local_reset_codes(expires_at);

CREATE TABLE auth_local_reset_sends (               -- one row per code sent: the 60 s cooldown and the daily caps (user, number, installation)
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  sent_at            REAL NOT NULL,                 -- epoch seconds; rows older than 24 h are pruned by the janitor
  user_id            TEXT NOT NULL,                 -- no foreign key: deleting a user must not hand the number / installation a fresh budget
  number_key         TEXT NOT NULL                  -- the same keyed hash as above
);
CREATE INDEX idx_auth_local_reset_sends_user ON auth_local_reset_sends(user_id, sent_at);
CREATE INDEX idx_auth_local_reset_sends_number ON auth_local_reset_sends(number_key, sent_at);
CREATE INDEX idx_auth_local_reset_sends_at ON auth_local_reset_sends(sent_at);

-- A live code dies with what it was issued under, whichever code path makes the change (the service also deletes explicitly):
-- a password set / re-hash or a reset-mode change of the credential row,
CREATE TRIGGER trg_alrc_credentials AFTER UPDATE OF password_hash, set_at, reset_mode ON auth_local_credentials
WHEN NEW.password_hash IS NOT OLD.password_hash OR NEW.set_at IS NOT OLD.set_at OR NEW.reset_mode IS NOT OLD.reset_mode BEGIN
  DELETE FROM auth_local_reset_codes WHERE user_id = NEW.user_id;
END;
-- the user disabled or (soft / hard) deleted,
CREATE TRIGGER trg_alrc_user_off AFTER UPDATE OF active, deleted_at ON users WHEN NEW.active = 0 OR NEW.deleted_at IS NOT NULL BEGIN
  DELETE FROM auth_local_reset_codes WHERE user_id = NEW.id;
END;
CREATE TRIGGER trg_alrc_user_gone AFTER DELETE ON users BEGIN
  DELETE FROM auth_local_reset_codes WHERE user_id = OLD.id;
END;
-- and every code when the Arx-only identity switch changes (or its row goes).
CREATE TRIGGER trg_alrc_switch_ins AFTER INSERT ON settings WHEN NEW.key = 'security.local_identity' BEGIN
  DELETE FROM auth_local_reset_codes;
END;
CREATE TRIGGER trg_alrc_switch_upd AFTER UPDATE ON settings WHEN NEW.key = 'security.local_identity' AND NEW.value IS NOT OLD.value BEGIN
  DELETE FROM auth_local_reset_codes;
END;
CREATE TRIGGER trg_alrc_switch_del AFTER DELETE ON settings WHEN OLD.key = 'security.local_identity' BEGIN
  DELETE FROM auth_local_reset_codes;
END;
