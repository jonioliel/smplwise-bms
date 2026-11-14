-- MU2: voice announcements (הכרזות קוליות). One row per announcement attempt: who asked (a person, or a rule), where (a room or a
-- device), what status it ended in. The rate limit counts these rows, the history in Settings reads them. The text is kept (an administrator
-- sees what was said); it is never a secret. The settings (enabled, engine, language, allowed speakers, limits) live in `settings`
-- under `announce.*` and are written only by the administrator.
CREATE TABLE announcements (
  id          TEXT PRIMARY KEY,
  at          TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('manual', 'test', 'rule')),
  user_id     TEXT,
  username    TEXT,
  rule_id     TEXT,
  scope       TEXT NOT NULL CHECK (scope IN ('device', 'area')),
  scope_ref   TEXT NOT NULL,
  targets_json TEXT NOT NULL DEFAULT '[]',
  message     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'limited', 'refused')),
  error       TEXT
);
CREATE INDEX idx_announcements_at ON announcements (at DESC);
