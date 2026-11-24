-- PROVISIONAL 0219 (MFA-TOKENS-2490, slice 6 of the MFA train, branch pilot/MFA-TOKENS-2490 from pilot/MFA-STEPUP-2490). 0217 / 0218 are
-- taken by 2.50 rows and the recovery-codes slice may add its own file: the number may be renumbered at integration; the content does
-- not depend on it. Design record: docs/changes/MFA-TOKENS-2490.md.
--
-- remote_token_uses: the Home Assistant access tokens Arx has SEEN on the remote bearer path (an API client or a native app sending
-- `Authorization: Bearer <HA token>` on every request), one row per HA sign-in (the refresh token behind the access tokens). It feeds
-- the user's token list (My Account), the once-only "first use from outside" audit row and the "last used in Arx" column.
-- The key is the SHA-256 of the refresh-token id the access tokens carry (`iss`, the same hash as remote_revoked_chains.iss_hash), or of
-- the token itself when it carries none. No token, no refresh-token id and no full address is stored: the address is masked (/24, /48)
-- and the client is a browser / system family. `kind` is what the token's own lifetime says once HA accepted it: long_lived (a long-lived
-- access token from the HA profile) | short_lived (a normal sign-in's 30-minute token) | unknown.
-- Arx never revokes or changes an HA token: the row is information, the sessions list ends Arx's own sessions as before.
-- Not a backup table (the archive is an allow-list): runtime history of THIS box. Rollback: older code never reads it; dropping it only
-- loses the list's history (the next use from outside is audited as a first use again).

CREATE TABLE remote_token_uses (
  token_key      TEXT PRIMARY KEY CHECK (length(token_key) = 64),
  user_id        TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('long_lived', 'short_lived', 'unknown')),
  first_seen_at  TEXT NOT NULL,
  last_seen_at   TEXT NOT NULL,
  last_address   TEXT,
  last_country   TEXT,
  agent          TEXT,
  uses           INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_remote_token_uses_user ON remote_token_uses (user_id, last_seen_at);
