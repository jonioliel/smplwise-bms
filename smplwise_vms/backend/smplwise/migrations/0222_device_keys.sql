-- MFA-DEVICEKEY-2490 (MFA-STEPUP-TRAIN-2490 slice 8 "DEVICEKEY-SRV + APP"; design docs/design/full-2fa-t095/DESIGN.md 4.4 and 6;
-- owner decisions 2026-11-22 Q51 "in the app, password + phone key counts as two-factor" and q23 b "biometric or the phone's screen
-- lock"). Additive only: the previous version ignores the table (rollback = the phone key simply stops counting; the app falls back to
-- the authenticator code). Number 0222: the lead's train allocation (2026-11-24: 0219 TOKENS, 0220 RECOVERY, 0221 POLICY, 0222 this
-- slice). RENUMBER AT MERGE only if the order changed.

-- One row per phone key. Only the PUBLIC key is stored (the SubjectPublicKeyInfo DER of an EC P-256 key the Android Keystore made
-- behind BiometricPrompt + CryptoObject); `fp` is SHA-256 of that DER (hex), unique over every row ever registered, so the same key can
-- never be registered twice, also not after a revoke. `auth_kind` is what the app declared the key needs per signature (biometric
-- only, or biometric or the screen lock - `security.device_key_auth`). `sign_count` counts verified signatures (a Keystore key has no
-- authenticator counter; this is bookkeeping only). A revoked key keeps its row (revoked_at / revoked_by / revoked_reason) so the
-- audit trail and the uniqueness of `fp` survive. `attestation_json` stays NULL until slice 9 (DEVICEKEY-ATTEST, owner Q52) fills it.
-- Never in a backup (services/backup.NEVER_EXPORTED_TABLES): factor material does not travel, like auth_totp.
CREATE TABLE IF NOT EXISTS auth_device_keys (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  label            TEXT NOT NULL DEFAULT '',
  spki             BLOB NOT NULL,
  fp               TEXT NOT NULL UNIQUE,
  alg              TEXT NOT NULL DEFAULT 'ES256' CHECK (alg IN ('ES256')),
  auth_kind        TEXT NOT NULL CHECK (auth_kind IN ('biometric', 'biometric_or_screen_lock')),
  platform         TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android')),
  created_at       TEXT NOT NULL,
  last_used_at     TEXT,
  sign_count       INTEGER NOT NULL DEFAULT 0,
  revoked_at       TEXT,
  revoked_by       TEXT,
  revoked_reason   TEXT,
  attestation_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_device_keys_user ON auth_device_keys (user_id, revoked_at);
