-- Number 0178 (ANNOUNCEB-295, stage B: announcements also on screens; the next free number after 0177 on release/2210 - another branch may take the
-- same number, renumber at integration).
-- An announcement may also be SHOWN on the screens an administrator allowed (notice TV boards and wall displays; settings `announce.screens.*`):
--   screens_json  the screen keys it reaches (`board:<id>`, `wall:<user id>`); '[]' = speakers only, as in stage A
--   screen_until  the instant it stops being shown (UTC ISO); NULL = never shown on a screen
-- Additive only: stage A code never reads the columns and ignores them. Rollback = run the previous version.
ALTER TABLE announcements ADD COLUMN screens_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE announcements ADD COLUMN screen_until TEXT;
CREATE INDEX idx_announcements_screen ON announcements (screen_until);
