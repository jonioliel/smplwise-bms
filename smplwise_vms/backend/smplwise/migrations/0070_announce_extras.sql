-- ANN2 (voice announcements, extras): an announcement can now also come from the notification pipeline (source 'notification',
-- linked to the notification), and a row keeps short machine notes about what was skipped or done around the speech (volume not
-- supported, paused and resumed, quiet hours lowered it). The new settings (volume, pause music, quiet hours, notification routing)
-- live in `settings` under `announce.*`, off by default. SQLite cannot widen a CHECK, so the table is rebuilt (rows are kept as they are).
-- Rollback = run the previous version: it never writes the new source value, and the extra columns are ignored by it.
CREATE TABLE announcements_new (
  id          TEXT PRIMARY KEY,
  at          TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('manual', 'test', 'rule', 'notification')),
  user_id     TEXT,
  username    TEXT,
  rule_id     TEXT,
  scope       TEXT NOT NULL CHECK (scope IN ('device', 'area')),
  scope_ref   TEXT NOT NULL,
  targets_json TEXT NOT NULL DEFAULT '[]',
  message     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'limited', 'refused')),
  error       TEXT,
  notification_id TEXT,
  notes_json  TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO announcements_new(id, at, source, user_id, username, rule_id, scope, scope_ref, targets_json, message, status, error)
  SELECT id, at, source, user_id, username, rule_id, scope, scope_ref, targets_json, message, status, error FROM announcements;
DROP TABLE announcements;
ALTER TABLE announcements_new RENAME TO announcements;
CREATE INDEX idx_announcements_at ON announcements (at DESC);
