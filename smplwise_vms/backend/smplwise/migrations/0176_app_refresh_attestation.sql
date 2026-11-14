-- PROVISIONAL number 0160 (ATTEST232-295, built on release/2150 where 0159 is the highest). Renumber at integration if another branch took 0160;
-- the content does not depend on the number. Design record: docs/changes/CR-ATTEST232.md.
--
-- Device hardware attestation (Android Key Attestation / iOS App Attest): the last verdict the server reached about the hardware key a
-- device registration presented at mint. One row per device registration (mobile_devices.id), replaced by every mint that carries or
-- should carry an attestation. The row holds a verdict only - never the attestation chain, the certificates or the challenge.
--   status       verified | failed | unavailable | missing   (unavailable = no verifier / no trust roots could judge; missing = none sent)
--   level        software | tee | strongbox | app_attest | NULL
--   format       android_key_attestation | ios_app_attest | NULL
--   key_fp       SHA-256 hex of the device key the verdict is about (NULL when the mint bound no key)
--   mode         the enforcement mode in force when the verdict was reached (log_only | required)
--   reason       a short code (no free text, no input echoed)
-- Never exported or restored (services/backup.NEVER_EXPORTED_TABLES): a restore can not manufacture a "verified" device.
-- Rollback: older code ignores the table.

CREATE TABLE app_refresh_attestations (
  device_id   TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('verified','failed','unavailable','missing')),
  level       TEXT,
  format      TEXT,
  key_fp      TEXT CHECK (key_fp IS NULL OR length(key_fp) = 64),
  mode        TEXT NOT NULL,
  reason      TEXT,
  checked_at  TEXT NOT NULL
);
CREATE INDEX idx_app_refresh_attestations_user ON app_refresh_attestations (user_id);
