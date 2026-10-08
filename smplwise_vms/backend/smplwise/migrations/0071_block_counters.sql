-- SEC3 (2.2.0 security review L4): the in-memory block counters survive an add-on restart. Additive only: the table is ignored by
-- the previous version (rollback = run it; the counters then live in memory again, as before).
-- One row per counter key inside its window: the instants (epoch seconds, JSON list) of the attempts that still count, and the
-- instant after which the row can no longer matter (dropped by the janitor). No code, no secret, no token: a key is a scope plus
-- an address or a user / panel id.
--   scope 'signin'     - the remote sign-in / second-factor rate limiter (services/ha_user_auth.RateLimiter), written behind
--   scope 'alarm_code' - the wrong alarm-code window (services/alarm_codes.Lockout), written with the wrong code itself
CREATE TABLE block_counters (
  scope      TEXT NOT NULL,
  key        TEXT NOT NULL,
  hits_json  TEXT NOT NULL DEFAULT '[]',
  expires_at REAL NOT NULL,
  PRIMARY KEY (scope, key)
);
CREATE INDEX idx_block_counters_expires ON block_counters (expires_at);
