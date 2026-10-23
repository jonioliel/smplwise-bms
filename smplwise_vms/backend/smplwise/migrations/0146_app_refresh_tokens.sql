-- Final number 0146 (built as PROVISIONAL 0150; renumbered at the 2.14.0 integration, release/2140) (APPREFRESH-295, branch pilot/APPREFRESH-295 from origin/main c37c75c91 = 2.12.3).
-- The content does not depend on the number. Design record: docs/changes/CR-APPREFRESH295.md.
--
-- The phone app's persistent sign-in (board item r122): rotating, single-use app refresh tokens in FAMILIES, and the short-lived access
-- tokens a refresh hands out. No column holds token material: a token is stored only as SHA-256(token) (256-bit random values, so a
-- leaked database or backup yields nothing usable). None of these tables is a backup table (services/backup.NEVER_EXPORTED_TABLES): a
-- restore can never revive a revoked family or an already-used token.
--
--  app_refresh_families  one sign-in of one phone install: bound to the device registration (mobile_devices.id) and the SHA-256 of its
--                        install_id; the anchor names the sign-in it was minted from (the hashed HA refresh-token id `iss_hash`, or the
--                        hashed Arx-only chain id) so revoking that sign-in revokes the family. Absolute and idle expiry, a generation
--                        counter, revoked_at / revoked_reason. At most one live family per device (a new one replaces the old).
--  app_refresh_tokens    every refresh token ever issued for a family (single use): live -> used (rotated) | superseded (a retry inside
--                        the grace replaced its unused child) | revoked. Presenting a used / superseded token outside the grace is REUSE:
--                        the whole family is revoked.
--  app_access_tokens     the short-lived bearer tokens (minutes) a refresh returns; they die with their family.
-- Rollback: older code never reads these tables; dropping them signs every phone out of the persistent sign-in (nothing else).

CREATE TABLE app_refresh_families (
  family_id            TEXT PRIMARY KEY CHECK (length(family_id) BETWEEN 8 AND 64),
  user_id              TEXT NOT NULL,
  device_id            TEXT NOT NULL,
  install_hash         TEXT NOT NULL CHECK (length(install_hash) = 64),
  platform             TEXT,
  anchor_kind          TEXT NOT NULL CHECK (anchor_kind IN ('ha', 'local', 'ingress', 'dev', 'none')),
  anchor_hash          TEXT NOT NULL DEFAULT '',
  channel              TEXT NOT NULL,
  admin_capped         INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL,
  last_used_at         TEXT NOT NULL,
  absolute_expires_at  TEXT NOT NULL,
  idle_expires_at      TEXT NOT NULL,
  generation           INTEGER NOT NULL DEFAULT 1,
  revoked_at           TEXT,
  revoked_reason       TEXT
);
CREATE INDEX idx_app_refresh_families_user ON app_refresh_families (user_id, revoked_at);
CREATE INDEX idx_app_refresh_families_device ON app_refresh_families (device_id, revoked_at);
CREATE INDEX idx_app_refresh_families_anchor ON app_refresh_families (anchor_hash) WHERE anchor_hash <> '';

CREATE TABLE app_refresh_tokens (
  token_hash   TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  family_id    TEXT NOT NULL,
  generation   INTEGER NOT NULL,
  parent_hash  TEXT,
  child_hash   TEXT,
  state        TEXT NOT NULL DEFAULT 'live' CHECK (state IN ('live', 'used', 'superseded', 'revoked')),
  issued_at    TEXT NOT NULL,
  used_at      TEXT
);
CREATE INDEX idx_app_refresh_tokens_family ON app_refresh_tokens (family_id, state);

CREATE TABLE app_access_tokens (
  token_hash   TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  family_id    TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  issued_at    TEXT NOT NULL,
  expires_at   TEXT NOT NULL
);
CREATE INDEX idx_app_access_tokens_family ON app_access_tokens (family_id);
CREATE INDEX idx_app_access_tokens_expires ON app_access_tokens (expires_at);
