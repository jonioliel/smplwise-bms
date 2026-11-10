-- HOME-SIMPLE-2421 (owner decisions 2026-11-10): the personal room wallpaper of the home interface.
--
-- home_room_image: one person's own picture for one room's screen (only when the installation setting `home.wallpaper` is
--   `gallery_image`). The upload is re-encoded by the server (services/bill_pdf_logo.sanitize_image: PNG / JPEG only, pixels rebuilt,
--   EXIF dropped, long side <= 1920 px, <= 2 MB) and kept as base64 text so it travels as JSON in a project backup (the brand_assets
--   pattern; services/backup.PROJECT_TABLES). Served only to its owner (GET /home/wallpaper/{room_key}). Additive: the previous
--   version ignores the table (rollback = leave it).
--
-- The new default interface for people nobody configured (full for everyone) must not move anyone who arrived under 2.42.0 without
-- a policy row: the start that applies this migration writes their 2.42.0 default as an explicit row
-- (services/home_interface.freeze_legacy_defaults, called from main.py - the administrator test needs the role model, not SQL).
CREATE TABLE home_room_image (
  user_id     TEXT NOT NULL,
  room_key    TEXT NOT NULL,
  mime        TEXT NOT NULL CHECK (mime IN ('image/png', 'image/jpeg')),
  data_b64    TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, room_key)
);
