-- Number 0174 (assigned by the lead for pilot/SESSIONEXCH2-295; 0172 / 0173 / 0175 / 0176 belong to other branches). The content does
-- not depend on the number.
-- Design record: docs/changes/APPREFRESH-SESSION-EXCHANGE-SPEC.md revision 3 (owner decisions 427-432 of 2026-10-24); service:
-- services/app_session.py. Behind `security.app_session_exchange` (default off): nothing writes these tables while it is off.
--
-- The phone app's WebView session, obtained through a ONE-TIME CODE: the app (native client, a live access token + a device-key proof)
-- obtains a short-lived single-use code; the WebView redeems it with a top-level navigation and the server sets the Arx session cookie.
--
--  app_session_codes  one row per issued code (only SHA-256 of the code is stored)
--    family_id / user_id / device_id   the saved sign-in (app_refresh_families) the code was issued for
--    key_fp                            the full SHA-256 fingerprint of the family's device key that signed the exchange (device binding)
--    origin_hash                       SHA-256 of `<scheme>://<host><remote_path>/` of the exchange request (origin binding)
--    expires_at / used_at / used_reason  60 seconds, single use (spent at the first redeem, also when it is then refused)
--  app_web_sessions   one row per WebView session (only SHA-256 of the cookie value is stored; `public_id` is the sessions list id)
--    expires_at / idle_expires_at      absolute (<= 7 days, administrators 1 h) and idle (<= 60 min, administrators 30 min)
--    perm_fingerprint                  the user's permission fingerprint at creation (a change ends the session)
--  app_refresh_families.ha_mfa       1 / 0: the minting HA sign-in's MFA flag (NULL: an Arx-only family, or minted before 0174)
--  app_refresh_families.factor_at    when the minting Arx-only session had shown the second factor (NULL otherwise)
-- Both tables are never exported (services/backup.NEVER_EXPORTED_TABLES): a restore can never revive a session or a code.
-- Rollback: older code ignores the tables and the columns; an `a.` cookie is unknown to it and answers 401 remote_login_required.

CREATE TABLE app_session_codes (
  code_hash    TEXT PRIMARY KEY CHECK (length(code_hash) = 64),
  family_id    TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  key_fp       TEXT NOT NULL CHECK (length(key_fp) = 64),
  origin_hash  TEXT NOT NULL CHECK (length(origin_hash) = 64),
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  used_at      TEXT,
  used_reason  TEXT
);
CREATE INDEX idx_app_session_codes_family ON app_session_codes (family_id);

CREATE TABLE app_web_sessions (
  sid_hash          TEXT PRIMARY KEY CHECK (length(sid_hash) = 64),
  public_id         TEXT NOT NULL UNIQUE CHECK (length(public_id) = 20),
  family_id         TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  device_id         TEXT NOT NULL,
  key_fp            TEXT NOT NULL CHECK (length(key_fp) = 64),
  created_at        TEXT NOT NULL,
  last_used_at      TEXT NOT NULL,
  expires_at        TEXT NOT NULL,
  idle_expires_at   TEXT NOT NULL,
  perm_fingerprint  TEXT NOT NULL DEFAULT '',
  ip_masked         TEXT NOT NULL DEFAULT '',
  user_agent        TEXT NOT NULL DEFAULT '',
  revoked_at        TEXT,
  revoked_reason    TEXT
);
CREATE INDEX idx_app_web_sessions_family ON app_web_sessions (family_id);
CREATE INDEX idx_app_web_sessions_user ON app_web_sessions (user_id);

ALTER TABLE app_refresh_families ADD COLUMN ha_mfa INTEGER;
ALTER TABLE app_refresh_families ADD COLUMN factor_at TEXT;
