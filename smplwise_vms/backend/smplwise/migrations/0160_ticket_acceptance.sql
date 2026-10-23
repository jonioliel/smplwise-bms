-- CR-ACCEPT102 (board r102) slice 1, PROVISIONAL number: the smart acceptance of vendor work - after a ticket is marked `done`, the sensor
-- data must show the fix HELD for a configurable time before the ticket is confirmed automatically. Slice 1: temperature units only.
-- Default OFF: the single settings row has enabled = 0, and a ticket is only eligible when its category is opted in (categories_json).

CREATE TABLE ticket_acceptance_settings (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  enabled        INTEGER NOT NULL DEFAULT 0,            -- the master switch
  hold_minutes   INTEGER NOT NULL DEFAULT 1440 CHECK (hold_minutes BETWEEN 30 AND 10080),
  start_grace_minutes INTEGER NOT NULL DEFAULT 240 CHECK (start_grace_minutes BETWEEN 15 AND 4320),  -- how long the unit may take to get back in range
  on_breach      TEXT NOT NULL DEFAULT 'flag' CHECK (on_breach IN ('flag', 'reopen', 'restart')),
  max_restarts   INTEGER NOT NULL DEFAULT 2 CHECK (max_restarts BETWEEN 0 AND 10),
  categories_json TEXT NOT NULL DEFAULT '[]',           -- ticket_categories.id values opted in (empty = nothing is eligible)
  updated_by     TEXT,
  updated_at     TEXT
);
INSERT INTO ticket_acceptance_settings(id) VALUES (1);

-- One row per ticket that entered verification (the audit of the decision; removed only with the ticket).
-- state: pending (done, waiting for the unit to be in range) | holding (clock running) | accepted | flagged | reopened | overridden
CREATE TABLE ticket_acceptance (
  ticket_id      TEXT PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('temperature')),
  subject_id     TEXT NOT NULL,                          -- infra_temp_units.id
  state          TEXT NOT NULL CHECK (state IN ('pending', 'holding', 'accepted', 'flagged', 'reopened', 'overridden')),
  on_breach      TEXT NOT NULL,                          -- the rule frozen when verification started
  hold_minutes   INTEGER NOT NULL,
  start_grace_minutes INTEGER NOT NULL,
  max_restarts   INTEGER NOT NULL,
  restarts       INTEGER NOT NULL DEFAULT 0,
  done_at        TEXT NOT NULL,
  done_seq       INTEGER NOT NULL,                       -- how many times the ticket had entered `done` when verification began (a counter, not a clock: two dones in one second still differ)
  pending_since  TEXT NOT NULL,
  hold_start     TEXT,
  hold_until     TEXT,
  finished_at    TEXT,
  outcome        TEXT,                                   -- accepted | breach | start_timeout | status_changed:<status>
  breach_event_id TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_ticket_acceptance_state ON ticket_acceptance (state);
