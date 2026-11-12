-- HOME-V3-P2-2431 (approved mockup round 27, phase 2 "family and building"): the person's own "do not disturb" night window.
--
-- home_notify_quiet: one row per person who set it in the home interface ("ההתראות שלי" > "לא להפריע בלילה"). While `enabled` and the
--   installation's local time is inside [start, end) (a window may cross midnight), the phone push channel holds that person's pushes
--   (services/mobile_push.AppPushChannel, delivery reason `dnd`), except a critical notification, an escalation and the categories
--   services/home_family.DND_PASS (the alarm and the doors). The inbox, e-mail and every other person are untouched.
-- Presentation-level personal preference: travels with the project backup (services/backup.PROJECT_TABLES). Additive: the previous
-- version ignores the table (rollback = leave it; nobody's pushes are held by a version that does not read it).
CREATE TABLE home_notify_quiet (
  user_id     TEXT PRIMARY KEY,
  enabled     INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  start_hm    TEXT NOT NULL DEFAULT '22:00',
  end_hm      TEXT NOT NULL DEFAULT '07:00',
  updated_at  TEXT NOT NULL
);
