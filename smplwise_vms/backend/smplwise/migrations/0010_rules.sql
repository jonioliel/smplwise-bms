-- 0010: alarm rules and their alerts (MASTER_SPEC ch. 28, T052). A rule matches stored events (never devices) by
-- trigger, scope, time window and cooldown; the only action in the pilot is a VMS notification (alert row). Alerts
-- are not events, so a rule can never feed itself; a rule owned by Home Assistant is a reference and is never
-- evaluated here (one owner per automation).

CREATE TABLE rules (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  enabled          INTEGER NOT NULL DEFAULT 1,
  owner            TEXT NOT NULL DEFAULT 'local' CHECK (owner IN ('local', 'ha')),
  ha_automation_id TEXT,
  trigger_json     TEXT NOT NULL,
  scope_json       TEXT NOT NULL,
  window_json      TEXT NOT NULL,
  cooldown_s       INTEGER NOT NULL DEFAULT 300,
  actions_json     TEXT NOT NULL,
  revision         INTEGER NOT NULL DEFAULT 1,
  created_by       TEXT,
  created_by_username TEXT,
  updated_by       TEXT,
  updated_by_username TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  last_fired_at    TEXT
);

CREATE TABLE rule_alerts (
  id          TEXT PRIMARY KEY,
  rule_id     TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  event_id    TEXT NOT NULL,
  camera_id   TEXT,
  entity_id   TEXT,
  fired_at    TEXT NOT NULL,
  occurred_at TEXT NOT NULL,           -- the event's own time: cooldowns compare event times, not receipt times
  reasons_json TEXT NOT NULL,
  message     TEXT NOT NULL DEFAULT '',
  acked_at    TEXT,
  acked_by    TEXT,
  acked_by_username TEXT
);
CREATE UNIQUE INDEX idx_rule_alerts_once ON rule_alerts (rule_id, event_id);
CREATE INDEX idx_rule_alerts_time ON rule_alerts (fired_at DESC);
CREATE INDEX idx_rule_alerts_rule_target ON rule_alerts (rule_id, camera_id, entity_id, fired_at);
