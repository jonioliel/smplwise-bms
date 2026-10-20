-- PROVISIONAL number 0143 (pilot/HMACROT-295, built on origin/main 61ddf6a91 whose last migration is 0127). The lead renumbers it
-- at integration; the content does not depend on the number.
--
-- CR-WISKEY-HMAC-ROTATION-295: the bridge HMAC key set (key ids, sealed material) and the rotation history.
--  - bridge_keys: one row per key. `value_enc` is the AES-256-GCM blob of connection_store.seal_bridge_key (AAD bound to the kid);
--    it is wiped (NULL) when the key is retired or discarded - the row stays for the audit trail. Never a key, a hash, a length or
--    any other derivative in clear. Exactly one `current` key (partial unique index).
--  - bridge_rotations: one row per rotation. No key, salt, proof, nonce or signature - ids, states, codes and times only. One
--    active rotation at a time (partial unique index over the active states).
-- Neither table is a backup table (services/backup.NEVER_EXPORTED_TABLES): an archive never carries them, a restore never touches them.
-- Nothing reads these tables while `bridge.key_rotation` is off (and it cannot be switched on in this build: GO_LIVE_PERMITTED).
-- Rollback: older code never reads either table; dropping them loses only fake-mode history.

CREATE TABLE bridge_keys (
  kid            TEXT PRIMARY KEY CHECK (length(kid) BETWEEN 4 AND 40),
  generation     INTEGER NOT NULL CHECK (generation >= 0),
  state          TEXT NOT NULL CHECK (state IN ('pending', 'next', 'current', 'retiring', 'retired', 'discarded')),
  value_enc      TEXT,                                 -- sealed material; NULL once retired / discarded
  rotation_id    TEXT,                                 -- the rotation that created it (NULL for the adopted legacy key)
  created_at     TEXT NOT NULL,
  activated_at   TEXT,                                 -- became `current`
  verify_until   TEXT,                                 -- `retiring` only: inbound verify ends here (UTC)
  ended_at       TEXT,                                 -- retired / discarded
  CHECK (state IN ('retired', 'discarded') OR value_enc IS NOT NULL),
  CHECK (state NOT IN ('retired', 'discarded') OR value_enc IS NULL)
);
CREATE UNIQUE INDEX bridge_keys_one_current ON bridge_keys(state) WHERE state = 'current';

CREATE TABLE bridge_rotations (
  id               TEXT PRIMARY KEY,
  mode             TEXT NOT NULL CHECK (mode IN ('routine', 'hard_cut')),
  state            TEXT NOT NULL CHECK (state IN ('prepared', 'publishing', 'published', 'confirmed', 'switching', 'switched', 'retiring',
                                                   'retired', 'verified', 'verify_failed', 'rolled_back', 'needs_repair')),
  kid_from         TEXT NOT NULL,
  kid_to           TEXT NOT NULL,
  gen_from         INTEGER NOT NULL,
  gen_to           INTEGER NOT NULL,
  overlap_s        INTEGER NOT NULL CHECK (overlap_s BETWEEN 0 AND 120),
  started_by       TEXT,
  started_at       TEXT NOT NULL,
  t0_at            TEXT,                               -- publish sent (the overlap budget starts here)
  switched_at      TEXT,
  ended_at         TEXT,
  result_code      TEXT,
  peer_retire_ok   INTEGER,                            -- NULL until retire; 0 = the peer did not confirm (its own cap ends its window)
  anchor_eligible  INTEGER NOT NULL DEFAULT 0 CHECK (anchor_eligible IN (0, 1)),
  steps_json       TEXT NOT NULL DEFAULT '[]'          -- [{step, ok, code, at}] - codes only
);
CREATE UNIQUE INDEX bridge_rotations_one_active ON bridge_rotations((1))
  WHERE state IN ('prepared', 'publishing', 'published', 'confirmed', 'switching', 'switched', 'retiring');
CREATE INDEX bridge_rotations_started ON bridge_rotations(started_at);
