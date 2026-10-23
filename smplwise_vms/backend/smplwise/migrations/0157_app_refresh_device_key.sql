-- Final number 0157 (built as PROVISIONAL 0153 on pilot/APPREFRESH2-295; renumbered at the 2.15.0 integration, release/2150). It stays AFTER
-- the app refresh tables (0146_app_refresh_tokens.sql, released in 2.14.0); the content does not depend on the number.
-- Design record: docs/changes/CR-APPREFRESH295.md section 13; wire contract: docs/changes/APPREFRESH-DEVICEKEY-SPEC.md.
--
-- The device-bound key of the phone app's persistent sign-in (owner decision 6, 2026-10-23: required before the app ships to customers).
-- At mint the app sends the PUBLIC half of an ECDSA P-256 key pair it generated in the Android Keystore / iOS Secure Enclave (the private
-- half never leaves the phone); every refresh then carries a signature over a single-use server nonce, verified against this key.
--
--  app_refresh_families  + device_key_spki      the public key, SubjectPublicKeyInfo DER, base64url (NULL: no key bound - slice 1 family)
--                        + device_key_fp        SHA-256(SPKI DER), 64 hex - the key's identity (audit rows carry only a 16-hex prefix)
--                        + device_key_alg       'ES256' (the only value)
--                        + device_key_bound_at  when the key was bound (the mint)
--  app_refresh_nonces    single-use proof-of-possession nonces (SHA-256 at rest), bound to one family, minutes-long; consumed by the
--                        refresh that presents them (also a refused one). Not a backup table (services/backup.NEVER_EXPORTED_TABLES).
-- A public key is not a secret, but it is never exported either: the four columns live in a never-exported table.
-- Rollback: older code ignores the columns and the table (a family with a key then refreshes WITHOUT a proof - roll back only together with
-- switching security.app_refresh off, which ends every family).

ALTER TABLE app_refresh_families ADD COLUMN device_key_spki TEXT;
ALTER TABLE app_refresh_families ADD COLUMN device_key_fp TEXT CHECK (device_key_fp IS NULL OR length(device_key_fp) = 64);
ALTER TABLE app_refresh_families ADD COLUMN device_key_alg TEXT CHECK (device_key_alg IS NULL OR device_key_alg = 'ES256');
ALTER TABLE app_refresh_families ADD COLUMN device_key_bound_at TEXT;
CREATE INDEX idx_app_refresh_families_key ON app_refresh_families (device_key_fp) WHERE device_key_fp IS NOT NULL;

CREATE TABLE app_refresh_nonces (
  nonce_hash   TEXT PRIMARY KEY CHECK (length(nonce_hash) = 64),
  family_id    TEXT NOT NULL,
  issued_at    TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  used_at      TEXT
);
CREATE INDEX idx_app_refresh_nonces_family ON app_refresh_nonces (family_id, issued_at);
CREATE INDEX idx_app_refresh_nonces_expires ON app_refresh_nonces (expires_at);
