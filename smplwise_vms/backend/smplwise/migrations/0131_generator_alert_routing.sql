-- Final number 0131 (GENALERT-295; built as PROVISIONAL 0141; renumbered at the 2.10.0 integration, integ/2100). The content does not depend on the number.
--
-- GENALERT-295: who is told about a generator alert is an administrator's choice, per alert type OR per severity.
--  - `generator_severity_routing`: the default recipients (roles + named users) and channels of one SEVERITY on one generator. A type that has
--    no recipients / channels of its own inherits the default of the severity it fires with (services/generator_alerts.effective_routing).
--  - `generator_alert_policies.escalate_after_s`: the escalation delay the editor writes. Until now the editor wrote its "minutes until
--    escalation" into `after_s`, which the engine reads as an extra hold before the alert FIRES. Rows saved that way move to the new column.
CREATE TABLE generator_severity_routing (
  device_id        TEXT NOT NULL REFERENCES generator_devices(id) ON DELETE CASCADE,
  severity         TEXT NOT NULL CHECK (severity IN ('critical', 'alert', 'info')),
  recipients_json  TEXT NOT NULL DEFAULT '{"roles":[],"users":[]}',
  channels_json    TEXT NOT NULL DEFAULT '[]',      -- push | app | email ; inbox is implicit
  row_version      INTEGER NOT NULL DEFAULT 1,
  updated_by       TEXT,
  updated_at       TEXT,
  PRIMARY KEY (device_id, severity)
);

ALTER TABLE generator_alert_policies ADD COLUMN escalate_after_s INTEGER NOT NULL DEFAULT 0;
UPDATE generator_alert_policies SET escalate_after_s = after_s, after_s = 0 WHERE escalate = 1 AND after_s > 0;
