-- CR-WA-PACING-295 (docs/changes/CR-WA-PACING-295.md): the shared WhatsApp send budget - backoff state, the age clock of messages
-- that wait on the budget, and the hourly counters the administrator sees. Operational data (like messaging_send_ledger of 0082):
-- not a project-backup table, additive only (rollback = run the previous version; the tables are ignored by it).
-- PROVISIONAL NUMBER 0150: the lead renumbers at integration. No phone number, text or recipient is stored: a pair scope carries
-- the ledger's HMAC recipient key.
CREATE TABLE messaging_pacing_state (
  scope       TEXT PRIMARY KEY,             -- 'account:<account_key>' | 'pair:<account_key>:<recipient_key>'
  level       INTEGER NOT NULL,             -- consecutive rate answers (the doubling ladder)
  until       TEXT NOT NULL,                -- UTC ISO-8601 with milliseconds and Z: no send of an affected class before this
  updated_at  TEXT NOT NULL
);
CREATE TABLE messaging_pacing_wait (
  ref         TEXT PRIMARY KEY,             -- the waiting message (ticket_outbox.id)
  account_key TEXT NOT NULL,
  klass       TEXT NOT NULL CHECK (klass IN ('alert', 'code', 'ticket', 'reminder')),
  since       TEXT NOT NULL                 -- when it first waited on the budget: the queue age limit counts from here
);
CREATE INDEX idx_messaging_pacing_wait_account ON messaging_pacing_wait (account_key);
CREATE TABLE messaging_pacing_counter (
  hour        TEXT NOT NULL,                -- 'YYYY-MM-DDTHH' UTC
  account_key TEXT NOT NULL,
  klass       TEXT NOT NULL CHECK (klass IN ('alert', 'code', 'ticket', 'reminder')),
  metric      TEXT NOT NULL CHECK (metric IN ('sent', 'deferred', 'backoff', 'pair_backoff', 'expired')),
  n           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hour, account_key, klass, metric)
);
