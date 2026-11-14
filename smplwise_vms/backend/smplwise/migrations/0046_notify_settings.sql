-- CR-018: the installation's ONE notification settings row (administrator, permission notify.manage; owner decisions 4b, 5,
-- 6a, 7, 8a, 10b). There are no per-user preferences, so no per-user table: push_prefs stays readable for one release (the
-- legacy /push/prefs route and the old planner) and is then dropped. `email_json` holds host / port / security / user / from /
-- recipients / last test and NEVER the password, which lives in <data>/secrets/notify_email (mode 600, outside every backup).
-- `center_layout` (owner 2026-10-01): where the notification center opens on a desktop - a side glass sheet or a full page under investigate.
-- `failures_audience` (owner 2026-10-01): who is told that a schedule was not executed / an automation failed - the administrators (default)
-- or everyone who may see that schedule / automation.
CREATE TABLE notify_settings (
  id                        INTEGER PRIMARY KEY CHECK (id = 1),
  quiet_json                TEXT NOT NULL,
  pass_json                 TEXT NOT NULL,
  escalation_json           TEXT NOT NULL,
  lockscreen                TEXT NOT NULL DEFAULT 'type_place' CHECK (lockscreen IN ('generic', 'type_place', 'full')),
  image_in_push             INTEGER NOT NULL DEFAULT 0,
  companion_json            TEXT NOT NULL DEFAULT '{"critical_sound_safety": false}',
  retention_days            INTEGER NOT NULL DEFAULT 30,
  deliveries_retention_days INTEGER NOT NULL DEFAULT 14,
  email_json                TEXT NOT NULL DEFAULT '{}',
  center_layout             TEXT NOT NULL DEFAULT 'sheet' CHECK (center_layout IN ('sheet', 'page')),
  failures_audience         TEXT NOT NULL DEFAULT 'admins' CHECK (failures_audience IN ('admins', 'visible')),
  revision                  INTEGER NOT NULL DEFAULT 1,
  updated_by                TEXT,
  updated_at                TEXT
);
INSERT INTO notify_settings(id, quiet_json, pass_json, escalation_json) VALUES (
  1,
  '{"enabled": true, "from": "22:00", "to": "07:00", "days": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]}',
  '{"info": {"webpush": false, "email": false, "ha_mobile": false}, "alert": {"webpush": false, "email": false, "ha_mobile": false}, "critical": {"webpush": true, "email": true, "ha_mobile": true}}',
  '{"enabled": true, "after_min": 5, "steps": 2, "to": "managers"}'
);
