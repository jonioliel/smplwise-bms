-- Number 0177 (built as PROVISIONAL 0193 on pilot/ANNOUNCE-295; renumbered at the 2.20.0 integration on release/2200).
-- ANNOUNCE-295 (stage A, speakers only): the announcements log learns what stage A needs and what stage B (screens) will reuse.
--   source 'emergency'      the one-click emergency announcement (its own audit action `media.announce.emergency`)
--   scope  'all'            every allowed speaker (the emergency and the building-wide routine notice); a screen is still a device key
--                           of the catalogue, so stage B adds screen devices to the same `device` / `area` / `all` scopes
--   status 'queued' / 'cancelled'  a non-critical announcement held until the quiet hours end (`announce.quiet.mode = queue`), and one
--                           that was dropped (expired, author no longer permitted, queue full)
--   languages_json          the spoken languages in order (he / en / ru); template_id the template it came from; critical whether it
--                           was exempt from the quiet hours; release_at the instant a queued row is due
-- SQLite cannot widen a CHECK, so the table is rebuilt (rows are kept as they are), as 0070 did.
-- Rollback = run the previous version: it never writes the new values and ignores the extra columns.
CREATE TABLE announcements_new (
  id          TEXT PRIMARY KEY,
  at          TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('manual', 'test', 'rule', 'notification', 'emergency')),
  user_id     TEXT,
  username    TEXT,
  rule_id     TEXT,
  scope       TEXT NOT NULL CHECK (scope IN ('device', 'area', 'all')),
  scope_ref   TEXT NOT NULL,
  targets_json TEXT NOT NULL DEFAULT '[]',
  message     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'limited', 'refused', 'queued', 'cancelled')),
  error       TEXT,
  notification_id TEXT,
  notes_json  TEXT NOT NULL DEFAULT '[]',
  languages_json TEXT NOT NULL DEFAULT '[]',
  template_id TEXT,
  critical    INTEGER NOT NULL DEFAULT 0,
  release_at  TEXT,
  texts_json  TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO announcements_new(id, at, source, user_id, username, rule_id, scope, scope_ref, targets_json, message, status, error, notification_id, notes_json)
  SELECT id, at, source, user_id, username, rule_id, scope, scope_ref, targets_json, message, status, error, notification_id, notes_json FROM announcements;
DROP TABLE announcements;
ALTER TABLE announcements_new RENAME TO announcements;
CREATE INDEX idx_announcements_at ON announcements (at DESC);
CREATE INDEX idx_announcements_queue ON announcements (status, release_at);
