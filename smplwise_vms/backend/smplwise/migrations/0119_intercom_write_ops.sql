-- PROVISIONAL NUMBER (pilot/WISKEYFINAL2-281): 0119 is only "the next free number on this branch". Other 2.8.0 branches also number
-- after 0118; the integration renumbers this file to the next free number (release_check: contiguous sequence) - the content does not depend on it.
--
-- WisKey round 5, R5-A1 / R5-A6: a durable journal of WisKey PERSON writes (intent before dispatch, outcome after) so that an unresolved
-- write survives a restart or a standby takeover. Ids and codes only: never a PIN, a PIN hash, a card number, a name or a phone.
--   target  `person:<wiskey id>` - a write to an existing person (intercom_sync: editor writes, grant engine writes, card-capture
--           confirms); `create:grant:<grant id>` - the grant worker's users/create (no person id exists before it answers).
--   state   intent (recorded, not yet sent) -> dispatched (about to be / being sent) -> ok | refused | not_sent | unknown;
--           an unresolved row (dispatched / unknown) is closed only by `reconciled` (a fresh readback, see intercom_write_journal).
CREATE TABLE intercom_write_ops (
  id            TEXT PRIMARY KEY,
  target        TEXT NOT NULL,
  op            TEXT NOT NULL,                 -- the command key (person, deleted, capture_confirm, create)
  lane          TEXT NOT NULL,
  boot_id       TEXT NOT NULL,                 -- the process that recorded it
  state         TEXT NOT NULL CHECK (state IN ('intent', 'dispatched', 'ok', 'refused', 'not_sent', 'unknown', 'reconciled')),
  code          TEXT,                          -- WisKey's / the transport's code (closed vocabulary, never input)
  grant_id      TEXT,                          -- create intents: the grant
  subject_kind  TEXT,
  subject_id    TEXT,
  purpose_ref   TEXT,                          -- create intents: the access_purpose reference sent (`<source kind>:<ref>`), to match a recovered person
  result_ref    TEXT,                          -- create intents: the WisKey person id the create answered (or a recovered one)
  started_ts    REAL NOT NULL,                 -- epoch seconds
  finished_ts   REAL,                          -- the call was over (NULL: still out, or the process ended while it was out)
  reconciled_ts REAL,
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_intercom_write_ops_open ON intercom_write_ops (target) WHERE state IN ('intent', 'dispatched', 'unknown');
CREATE INDEX idx_intercom_write_ops_grant ON intercom_write_ops (grant_id) WHERE grant_id IS NOT NULL;
