-- LEASE-BUILD slice L1 (docs/changes/CR-WISKEY-LEASE-REVOCATION-EVENT.md section 2.3, the CR's provisional 0101): the Arx-side
-- capture lease ledger. PROVISIONAL NUMBER 0103 - 0098..0102 are taken by other branches in flight; the lead renumbers at
-- integration (the file name is the only place the number lives).
--
-- One row per lease Arx issued at `capture_start` (services/capture_lease.py). States: issued -> active -> (revoked | expired |
-- destroyed); terminal states are final (enforced in code, and no route other than the capture start inserts a row). Ids only:
-- no person or station name, no card value / mask / length / hash, no address, serial, MAC, nonce, signature or key.
-- Invariants enforced HERE, not only in code (section 2.2):
--   * one live lease per receiver  - partial unique index on (station_id, reader_id) WHERE state IN ('issued','active')
--   * one live lease per actor     - partial unique index on actor_user_id with the same predicate
--   * lifetime 0 < expires - issued <= 120 s (LEASE_MAX_S, a constant, not a setting) - CHECK, and again in the signer
-- The installation ceiling (3 live leases) is checked in the issuing transaction (a count under the write lock).
-- Retention: the janitor prunes terminal rows 7 days after `state_at`. Not a backup table (a restore never brings a lease back).
-- Rollback: additive; older code ignores the table. The route is behind `access.capture_lease` (absent = off).

CREATE TABLE capture_leases (
  id                  TEXT PRIMARY KEY,                       -- = lease_ref, UUIDv4
  actor_user_id       TEXT NOT NULL,
  actor_source        TEXT NOT NULL CHECK (actor_source IN ('ha', 'local')),
  station_id          TEXT NOT NULL,                          -- WisKey's opaque config_entry_id
  reader_id           INTEGER NOT NULL CHECK (reader_id BETWEEN 0 AND 8),
  person_id           TEXT NOT NULL,
  person_revision     INTEGER,
  binding_revision    TEXT,                                   -- opaque, as WisKey publishes it (W?); NULL while it does not
  permission_revision INTEGER NOT NULL,
  selection_revision  TEXT,
  stream_id           TEXT NOT NULL,
  sequence_at_issue   INTEGER NOT NULL CHECK (sequence_at_issue >= 0),
  start_request_id    TEXT NOT NULL UNIQUE,
  wiskey_session_id   TEXT,
  lease_issued_at     TEXT NOT NULL CHECK (lease_issued_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'),
  lease_expires_at    TEXT NOT NULL CHECK (lease_expires_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'),
  state               TEXT NOT NULL CHECK (state IN ('issued', 'active', 'revoked', 'expired', 'destroyed')),
  state_at            TEXT NOT NULL,
  reason              TEXT,
  revoke_sequence     INTEGER,
  revoke_attempts     INTEGER NOT NULL DEFAULT 0,
  acked_at            TEXT,
  ack_result          TEXT,
  created_at          TEXT NOT NULL,
  CHECK (strftime('%s', lease_issued_at) IS NOT NULL AND strftime('%s', lease_expires_at) IS NOT NULL),
  CHECK (CAST(strftime('%s', lease_expires_at) AS INTEGER) - CAST(strftime('%s', lease_issued_at) AS INTEGER) > 0),
  CHECK (CAST(strftime('%s', lease_expires_at) AS INTEGER) - CAST(strftime('%s', lease_issued_at) AS INTEGER) <= 120)
);

CREATE UNIQUE INDEX capture_leases_live_receiver ON capture_leases(station_id, reader_id) WHERE state IN ('issued', 'active');
CREATE UNIQUE INDEX capture_leases_live_actor ON capture_leases(actor_user_id) WHERE state IN ('issued', 'active');
CREATE INDEX capture_leases_state ON capture_leases(state, state_at);
