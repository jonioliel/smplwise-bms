-- PROVISIONAL NUMBER 0153 (CR-WATER78 slice 2, pilot/WATER78B-295): renumbered at the integration to the next free number (on
-- release/2140, where slice 1 is 0150 and the ticket acceptance is 0151, this file becomes 0152). The content does not depend on the number.
--
-- CR-WATER78 slice 2 (leak alerts): the installation's leak-rule defaults and alert routing (one row), the alert log (one OPEN row per
-- meter and kind, enforced by a partial unique index), the evaluator's per-meter cursor (the last 15-minute bucket judged, so a restart
-- neither repeats nor skips a burst bucket) and the per-meter mute. Per-meter rule overrides live in water_meters.rules_json (0152).
-- Nothing here describes a device action: the module never writes a device (owner Q6). Rollback: drop the three tables and the two
-- water_meters columns; nothing else reads them.

CREATE TABLE water_alert_settings (
  id                     INTEGER PRIMARY KEY CHECK (id = 1),
  night_from             TEXT NOT NULL DEFAULT '01:00',   -- owner Q8: 01:00-05:00, 6 L/h over two hours
  night_to               TEXT NOT NULL DEFAULT '05:00',
  night_min_lph          REAL NOT NULL DEFAULT 6,
  night_min_intervals    INTEGER NOT NULL DEFAULT 8,      -- consecutive 15-minute buckets (8 = two hours)
  abnormal_factor        TEXT NOT NULL DEFAULT '2.0',     -- decimal text: today > factor x the median of the same weekday
  abnormal_min_l         INTEGER NOT NULL DEFAULT 500,
  baseline_days          INTEGER NOT NULL DEFAULT 28,
  offline_min            INTEGER NOT NULL DEFAULT 120,
  alerts_enabled         INTEGER NOT NULL DEFAULT 1,      -- owner Q3: ON by default once the module is on
  quiet_enabled          INTEGER NOT NULL DEFAULT 0,
  quiet_from             TEXT NOT NULL DEFAULT '22:00',
  quiet_to               TEXT NOT NULL DEFAULT '07:00',
  quiet_includes_alarms  INTEGER NOT NULL DEFAULT 0,      -- an alarm is never held unless an administrator chose it
  mute_includes_alarms   INTEGER NOT NULL DEFAULT 0,
  kinds_json             TEXT,                            -- routing per alert kind (leak / abnormal / offline): enabled, recipients, channels
  row_version            INTEGER NOT NULL DEFAULT 0,
  updated_by             TEXT,
  updated_at             TEXT
);
INSERT INTO water_alert_settings(id) VALUES (1);

CREATE TABLE water_alert_events (
  id               TEXT PRIMARY KEY,
  meter_id         TEXT NOT NULL REFERENCES water_meters(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('night_flow', 'abnormal', 'burst', 'offline', 'health')),
  severity         TEXT NOT NULL CHECK (severity IN ('warning', 'alarm')),
  opened_at        TEXT NOT NULL,
  closed_at        TEXT,
  close_reason     TEXT,
  value_json       TEXT,                                  -- the litres / rate / baseline that fired (no person, no entity id)
  suppressed       TEXT CHECK (suppressed IS NULL OR suppressed IN ('off', 'quiet', 'mute', 'maintenance')),
  ack_by           TEXT,
  ack_at           TEXT,
  notification_id  TEXT
);
-- one open row per meter and kind (the deduplication the notification centre relies on)
CREATE UNIQUE INDEX idx_water_alert_events_open ON water_alert_events (meter_id, kind) WHERE closed_at IS NULL;
CREATE INDEX idx_water_alert_events_opened ON water_alert_events (opened_at);
CREATE INDEX idx_water_alert_events_meter ON water_alert_events (meter_id, opened_at);

CREATE TABLE water_alert_state (
  meter_id      TEXT PRIMARY KEY REFERENCES water_meters(id) ON DELETE CASCADE,
  last_bucket   INTEGER,                                  -- unix start of the last 15-minute bucket judged
  evaluated_at  TEXT
);

ALTER TABLE water_meters ADD COLUMN muted_until TEXT;      -- water.ack: holds WARNINGS only (alarms only with mute_includes_alarms)
ALTER TABLE water_meters ADD COLUMN muted_by TEXT;
