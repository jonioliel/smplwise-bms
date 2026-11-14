-- CR-INSIGHT215 slice 3 (docs/changes/CR-INSIGHT215.md): generator run counts / hours for the monthly building report, and the send ledger of
-- the scheduled monthly delivery. Final number 0153 (built as PROVISIONAL 0146; renumbered at the 2.15.0 integration, release/2150). Additive only; rollback =
-- run the previous version (the tables are ignored by it). No phone number, e-mail address or message text is stored anywhere here.

-- One row per engine run of a generator, written by the generator tick from the state mirror (read-only against the infrastructure).
-- `ended_at` is NULL while the run is open; `interrupted` = the mirror went silent and the run was closed at the last time it was seen.
CREATE TABLE generator_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id     TEXT NOT NULL,
  started_at    TEXT NOT NULL,                      -- UTC ISO-8601 with Z
  last_seen_at  TEXT NOT NULL,
  ended_at      TEXT,
  hours_start   REAL,                               -- the controller's own run-hours meter at the start / end, when the generator reports one
  hours_end     REAL,
  interrupted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_generator_runs_device ON generator_runs (device_id, started_at);
CREATE INDEX idx_generator_runs_open ON generator_runs (ended_at) WHERE ended_at IS NULL;

-- One row per (month, recipient) of the scheduled delivery; the unique key makes a month go out once however often the worker runs.
CREATE TABLE insights_report_sends (
  id             TEXT PRIMARY KEY,
  month          TEXT NOT NULL,                     -- 'YYYY-MM' of the report
  channel        TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  recipient_key  TEXT NOT NULL,                     -- a user id (whatsapp) or a short hash of the address (email); never the address
  user_id        TEXT,
  lang           TEXT NOT NULL DEFAULT 'he',
  status         TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'held', 'retry', 'sent', 'failed', 'skipped')),
  reason         TEXT,
  attempts       INTEGER NOT NULL DEFAULT 0,
  not_before     TEXT NOT NULL,
  created_by     TEXT,
  created_at     TEXT NOT NULL,
  finished_at    TEXT,
  UNIQUE (month, channel, recipient_key)
);
CREATE INDEX idx_insights_report_sends_due ON insights_report_sends (status, not_before);
