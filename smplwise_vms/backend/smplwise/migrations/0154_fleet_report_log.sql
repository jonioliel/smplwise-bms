-- Final number 0154 (built as PROVISIONAL 0149 on pilot/FLEET215-295; renumbered at the 2.15.0 integration, release/2150). The content does not depend on the number.
--
-- CR-FLEET215: what this installation sent to the SmplWise fleet receiver - one row per attempt, the last 30 kept
-- (services/fleet_report.LOG_KEEP). `payload_json` is the EXACT body that was signed and sent (canonical JSON, counters and states only,
-- validated against the closed schema before it was written), so the customer's administrator can see "what was sent last night".
-- A row with trigger `stop` is the one last signed "reporting stopped" message sent when the customer switched the report off.
-- A row with result `schema_refused` has no payload: nothing left the installation. No secret, no URL, no host and no signature is
-- stored here (the receiver's address is an add-on option and is never copied into the database).
-- Runtime history, never in a project backup (services/backup.NEVER_EXPORTED_TABLES).
-- Rollback: older code never reads this table; dropping it loses only the send history.

CREATE TABLE fleet_report_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  seq           INTEGER,
  kid           TEXT,
  created_at    TEXT NOT NULL,
  trigger       TEXT NOT NULL CHECK (trigger IN ('schedule', 'manual', 'stop')),
  actor_user_id TEXT,
  result        TEXT NOT NULL CHECK (result IN ('ok', 'rejected', 'unreachable', 'schema_refused')),
  http_status   INTEGER,
  payload_json  TEXT
);
