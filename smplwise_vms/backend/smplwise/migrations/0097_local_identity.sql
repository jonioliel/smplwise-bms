-- USR2 phase 1 (docs/design/USR2_ARX_ONLY_IDENTITY_SPEC.md section 5.1, owner answers 2026-10-16): Arx-only (local) identities.
-- Provisional number 0097 (the lead renumbers at integration; contiguous sequence rule). Additive only: no existing row changes,
-- no CHECK is added to users.source (the service layer validates it), and nothing here is used while the setting
-- `security.local_identity` is `off` (the default).

-- users: the one identity table stays the store for every source. A local user's id is 'l_' + 26 characters, so it never collides
-- with a Home Assistant user id (32 hex characters) and every reader can tell the source from the id alone.
ALTER TABLE users ADD COLUMN email        TEXT;          -- optional, for the notification e-mail channel only
ALTER TABLE users ADD COLUMN created_by   TEXT;          -- actor user id for source = 'local'
ALTER TABLE users ADD COLUMN disabled_at  TEXT;
ALTER TABLE users ADD COLUMN disabled_by  TEXT;
ALTER TABLE users ADD COLUMN deleted_at   TEXT;          -- soft delete; the hard delete (purge) is a later phase
ALTER TABLE users ADD COLUMN notes        TEXT;          -- administrator's note (<= 200 characters)

CREATE TABLE auth_local_credentials (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash      TEXT,                          -- PHC string ($scrypt$... or $argon2id$...); NULL until the first-login link is used
  params_version     INTEGER NOT NULL DEFAULT 1,    -- the hashing profile; a sign-in with an older one re-hashes
  set_at             TEXT,
  set_by             TEXT,                          -- 'self' | 'link' (an administrator never sets a password; only links)
  must_change        INTEGER NOT NULL DEFAULT 0,    -- 1 after a link issued with the "temporary" flag was used
  reset_mode         TEXT NOT NULL DEFAULT 'manager_only' CHECK (reset_mode IN ('manager_only', 'self_service')),  -- owner answer Q5
  last_sign_in_at    TEXT,
  last_sign_in_from  TEXT,                          -- masked address (ha_user_auth.mask_address) + country
  failed_count       INTEGER NOT NULL DEFAULT 0,    -- rolling counter of the per-account tier
  last_failed_at     REAL,                          -- epoch seconds of the newest counted failure (the 15-minute window)
  delay_until        REAL,                          -- epoch seconds; the per-account delay (section 10)
  unlocked_by        TEXT,
  updated_at         TEXT NOT NULL
);

CREATE TABLE auth_local_sessions (
  sid_hash           TEXT PRIMARY KEY,              -- SHA-256 of the cookie value; the cookie value itself is never stored
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('browser', 'app')),  -- owner answer Q6: an app refresh token (phase 5) adds rows of kind 'app'
  created_at         TEXT NOT NULL,
  chain_started_at   TEXT NOT NULL,                 -- the sign-in this row belongs to (rotations keep it)
  last_used_at       TEXT NOT NULL,
  expires_at         TEXT NOT NULL,                 -- absolute
  idle_expires_at    TEXT NOT NULL,                 -- sliding
  rotated_from       TEXT,                          -- previous sid_hash of the same chain
  chain_id           TEXT NOT NULL,                 -- one device's sign-in; rotations keep it (what the sessions list shows)
  factor_at          TEXT,                          -- when the second factor was shown on this chain (NULL = never)
  perm_fingerprint   TEXT NOT NULL DEFAULT '',      -- rbac.permissions_fingerprint at creation / rotation (a change rotates the session)
  ip_masked          TEXT NOT NULL DEFAULT '',
  country            TEXT NOT NULL DEFAULT '',
  user_agent         TEXT NOT NULL DEFAULT '',      -- <= 200 characters
  label              TEXT,                          -- the user's own device name (<= 40 characters)
  revoked_at         TEXT,
  revoked_reason     TEXT CHECK (revoked_reason IN ('logout', 'logout_all', 'admin', 'password_changed', 'factor_enabled',
                                                    'factor_reset', 'user_disabled', 'user_deleted', 'expired', 'idle', 'rotated',
                                                    'feature_off'))
);
CREATE INDEX idx_auth_local_sessions_user ON auth_local_sessions(user_id, revoked_at);
CREATE INDEX idx_auth_local_sessions_chain ON auth_local_sessions(chain_id);
CREATE INDEX idx_auth_local_sessions_rotated ON auth_local_sessions(rotated_from);

CREATE TABLE auth_local_links (                     -- first-login and reset links (section 7)
  token_hash         TEXT PRIMARY KEY,              -- SHA-256 of the 32-byte token; the token itself is never stored
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose            TEXT NOT NULL CHECK (purpose IN ('first_login', 'reset')),
  issued_by          TEXT NOT NULL,
  issued_via         TEXT NOT NULL CHECK (issued_via IN ('shown', 'whatsapp')),
  issued_channel     TEXT NOT NULL CHECK (issued_channel IN ('local', 'remote')),
  created_at         TEXT NOT NULL,
  expires_at         TEXT NOT NULL,
  used_at            TEXT,
  invalidated_at     TEXT,                          -- a newer link, a disable, a delete, a password change
  temporary          INTEGER NOT NULL DEFAULT 0     -- sets must_change
);
CREATE INDEX idx_auth_local_links_user ON auth_local_links(user_id);

CREATE TABLE auth_local_failures (                  -- the per-IP and global tiers, written behind from memory (the per-account tier lives on the credential row)
  key                TEXT PRIMARY KEY,              -- 'ip:' + SHA-256(address)[:32] + ':' + window | 'global'
  window_start       REAL NOT NULL,
  count              INTEGER NOT NULL,
  blocked_until      REAL,
  updated_at         REAL NOT NULL
);

-- section 11 / owner answer Q7: one person may hold an HA identity and a local identity; the manual link is informational
-- (authority is never unioned) and drives the "disable the other one too?" suggestion.
CREATE TABLE identity_links (
  ha_user_id         TEXT NOT NULL,
  local_user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_by          TEXT NOT NULL,
  linked_at          TEXT NOT NULL,
  PRIMARY KEY (ha_user_id, local_user_id)
);
CREATE UNIQUE INDEX idx_identity_links_local ON identity_links(local_user_id);
