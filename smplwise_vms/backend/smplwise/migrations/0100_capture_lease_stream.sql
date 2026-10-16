-- LEASE-BUILD slice L1 (docs/changes/CR-WISKEY-LEASE-REVOCATION-EVENT.md sections 1.3 and 2.3, the CR's provisional 0102): the
-- revocation stream. Number 0100 (provisional 0104 on pilot/LEASE-BUILD, renumbered at integ/264).
--
-- One row per stream; the CURRENT stream is the newest row (`created_at`, then rowid). `next_sequence` is the sequence the next
-- `lease_revoke` takes; it is incremented by a single-row UPDATE in the same transaction that marks the ledger rows revoked
-- (services/capture_lease.py). A heartbeat repeats `next_sequence - 1` and never advances it. A new row (and a signed
-- `lease_stream_reset`) on start-up with live rows or the route on, on re-pair, on a restore from backup and on key rotation.
-- Never pruned; not a backup table (a restored database always gets a fresh stream, never the archive's counter).
-- Rollback: additive.

CREATE TABLE capture_lease_stream (
  stream_id      TEXT PRIMARY KEY CHECK (length(stream_id) = 32 AND stream_id NOT GLOB '*[^0-9a-f]*'),
  next_sequence  INTEGER NOT NULL CHECK (next_sequence >= 1),
  created_at     TEXT NOT NULL,
  reason         TEXT NOT NULL CHECK (reason IN ('startup', 'repair', 'restore', 'key_rotation', 'host_lost_stream', 'first'))
);
