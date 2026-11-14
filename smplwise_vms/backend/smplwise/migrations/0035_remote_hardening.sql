-- 0035: CR-008 P2, remote-access hardening (SmplWise Arx).
--
-- remote_revoked_chains: a remote sign-in ended from the sessions list ("sign out everywhere" or an administrator's
-- revoke). The key is a SHA-256 of the HA refresh-token id the session's access tokens carry (the JWT `iss`), so the
-- browser cannot come straight back by re-exchanging a fresh access token of the same sign-in; a new sign-in (a new
-- refresh token) is not affected. No token, no cookie and no refresh-token id is stored in clear.
CREATE TABLE remote_revoked_chains (
  iss_hash   TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  revoked_at TEXT NOT NULL,
  revoked_by TEXT,
  reason     TEXT NOT NULL
);
CREATE INDEX idx_remote_revoked_chains_at ON remote_revoked_chains (revoked_at);

-- remote_sign_ins: the last remote sign-in of each user for the roles screen (kept apart from the audit log, which is
-- pruned and can be large). The address is stored masked (/24, /48) and the country is Cloudflare's CF-IPCountry.
CREATE TABLE remote_sign_ins (
  user_id        TEXT PRIMARY KEY,
  last_at        TEXT NOT NULL,
  last_address   TEXT,
  last_country   TEXT,
  sign_ins       INTEGER NOT NULL DEFAULT 0
);

-- csp_reports: Content-Security-Policy violation reports from the remote channel, as counters only (never the page
-- URL, the script sample or the full blocked URL): one row per disposition (enforce / report), effective directive and
-- blocked origin (scheme + host, or a keyword such as inline / eval / data). Bounded by the code (a fixed row cap,
-- overflow counted in one row).
CREATE TABLE csp_reports (
  disposition TEXT NOT NULL,
  directive   TEXT NOT NULL,
  blocked     TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  first_at    TEXT NOT NULL,
  last_at     TEXT NOT NULL,
  PRIMARY KEY (disposition, directive, blocked)
);
