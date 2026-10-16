-- USR2 phase 4 (docs/design/USR2_ARX_ONLY_IDENTITY_SPEC.md section 8.1, CR-USR2 section 9): passkeys (WebAuthn) of Arx-only identities.
-- Provisional number 0098 (the lead renumbers at integration; contiguous sequence rule). Additive only: one new table and one new
-- column with a default; nothing here is read while `security.local_identity` is `off` (the default).
--
-- Deviation from the design record (recorded in CR-USR2 section 9): `credential_id` and `public_key` are TEXT (base64url without
-- padding) instead of BLOB - the project backup writes rows as JSON, and the public keys travel in the access part of it exactly like
-- the password hashes (owner answer Q8). Challenges are never stored (memory only, single use, 60 s) and so never reach an archive.

CREATE TABLE auth_webauthn_credentials (
  id                 TEXT PRIMARY KEY,              -- 'pk_' + 20 hex: the public id the lists, routes and audit rows use
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id      TEXT NOT NULL UNIQUE,          -- base64url of the authenticator's credential id (not secret; never in an audit row)
  public_key         TEXT NOT NULL,                 -- base64url of the COSE_Key exactly as registered (public key only)
  alg                INTEGER NOT NULL CHECK (alg IN (-7, -257)),  -- ES256 | RS256
  sign_count         INTEGER NOT NULL DEFAULT 0,    -- the last counter seen (clone detection)
  transports         TEXT NOT NULL DEFAULT '',      -- comma list as reported by the browser (hints only)
  aaguid             TEXT NOT NULL DEFAULT '',      -- self-reported authenticator model, display only (attestation 'none')
  label              TEXT,                          -- the user's own name for it (<= 40 characters)
  backup_eligible    INTEGER NOT NULL DEFAULT 0,    -- BE flag at registration (a synced passkey)
  backup_state       INTEGER NOT NULL DEFAULT 0,    -- BS flag, refreshed on every use
  uv_registered      INTEGER NOT NULL DEFAULT 0,    -- the UV flag at registration
  rp_id              TEXT NOT NULL,                 -- the relying-party id it was made for (security.local_public_url's host)
  created_at         TEXT NOT NULL,
  last_used_at       TEXT
);
CREATE INDEX idx_auth_webauthn_user ON auth_webauthn_credentials(user_id);

-- the per-user "passkey first" mode (the user's own opt-in; it only has an effect while `security.local_passkey_first` is on). It
-- never removes the password: password sign-in and the manager's reset links keep working whatever this says.
ALTER TABLE auth_local_credentials ADD COLUMN passkey_first INTEGER NOT NULL DEFAULT 0;
