-- PROVISIONAL number 0158 (APPREFRESH3-295, branch pilot/APPREFRESH3-295 on top of pilot/APPREFRESH2B, whose 0153 is provisional too and is
-- 0157 on release/2150). Chosen above every number seen on the remote branches on 2026-10-23 except 0160 (two pilots); renumber at
-- integration - it must stay AFTER the device-key migration (0153 here / 0157 on release/2150). The content does not depend on the number.
-- Design record: docs/changes/CR-APPREFRESH295.md section 14; wire contract: docs/changes/APPREFRESH-DEVICEKEY-SPEC.md section 6a.
--
-- The device-key PIN: the last ES256 key a device registration bound, kept beyond the life of the sign-in (family) that bound it. Until
-- this table, the key lived only on the family row, so anything that ended the family - re-registering the device, the app's sign-out, the
-- user's or an administrator's "end this sign-in" - also forgot the key, and the next mint could bind ANY key without a proof by the old
-- one. Now a mint for a pinned device that would bind another key (or none) needs either the old key's `replaces` proof, or an
-- administrator-approved, audited, time-boxed reset (the lost-key path; the user is notified).
--
--  app_refresh_device_keys  one row per device registration (mobile_devices.id) that ever bound a key
--    device_key_spki / _fp / _alg   the pinned public key (SubjectPublicKeyInfo DER, base64url), SHA-256 hex, 'ES256'
--    bound_at / updated_at          when the key was first bound / last re-confirmed by a mint
--    reset_approved_at / _expires_at / reset_by / reset_reason
--                                   a pending administrator-approved reset: until reset_expires_at the device's next mint may bind a new
--                                   key (or none) without the old key's proof, once; consumed (cleared) by that mint or withdrawn
-- A public key is not a secret, but like the family columns it is never exported (services/backup.NEVER_EXPORTED_TABLES): a restore
-- can neither drop a pin (re-opening the weakness) nor revive one.
-- Backfill: the key of each device's newest keyed family (a live one first).
-- Rollback: older code ignores the table (the weakness returns: a new key binds after the old sign-in ended).

CREATE TABLE app_refresh_device_keys (
  device_id          TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  device_key_spki    TEXT NOT NULL,
  device_key_fp      TEXT NOT NULL CHECK (length(device_key_fp) = 64),
  device_key_alg     TEXT NOT NULL CHECK (device_key_alg = 'ES256'),
  bound_at           TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  reset_approved_at  TEXT,
  reset_expires_at   TEXT,
  reset_by           TEXT,
  reset_reason       TEXT
);
CREATE INDEX idx_app_refresh_device_keys_user ON app_refresh_device_keys (user_id);

INSERT OR IGNORE INTO app_refresh_device_keys(device_id, user_id, device_key_spki, device_key_fp, device_key_alg, bound_at, updated_at)
  SELECT device_id, user_id, device_key_spki, device_key_fp, 'ES256', COALESCE(device_key_bound_at, created_at), COALESCE(device_key_bound_at, created_at)
    FROM app_refresh_families
   WHERE device_key_fp IS NOT NULL AND device_key_spki IS NOT NULL
   ORDER BY (revoked_at IS NULL) DESC, COALESCE(device_key_bound_at, created_at) DESC;
