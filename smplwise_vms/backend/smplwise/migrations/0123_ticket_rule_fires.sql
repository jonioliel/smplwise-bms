-- CR-038 phase 2 (TKRULES-291, docs/changes/CR-038-TKRULES-NOTES.md): tickets opened automatically from alerts.
-- One row per (rule, notification row) the engine acted on - the idempotency of the engine (UNIQUE) and the source of the per-rule
-- daily count. Ids, dates and an outcome only: never a title, a place or a person.
--   outcome   created    a ticket was opened (counts against the rule's daily limit)
--             absorbed   an open ticket with the same stable key took the repeat (a system note), not counted
--             suppressed the rule's daily limit was reached (audited once), no ticket
--             refused    the creation path refused (department inactive, priority gone ...), audited, no ticket
--   day       the local date (installation time zone) of the fire, for the daily limit
--   cleared_at when the clear pass handled the end of the alert (the system note / close), NULL while pending
CREATE TABLE ticket_rule_fires (
  id               TEXT PRIMARY KEY,
  rule_id          TEXT NOT NULL,
  notification_id  TEXT NOT NULL,
  dedupe_key       TEXT NOT NULL,
  outcome          TEXT NOT NULL CHECK (outcome IN ('created', 'absorbed', 'suppressed', 'refused')),
  ticket_id        TEXT,
  day              TEXT NOT NULL,
  at               TEXT NOT NULL,
  cleared_at       TEXT,
  UNIQUE (rule_id, notification_id)
);
CREATE INDEX idx_ticket_rule_fires_day ON ticket_rule_fires (rule_id, day, outcome);
CREATE INDEX idx_ticket_rule_fires_pending ON ticket_rule_fires (cleared_at, outcome);
