-- PROVISIONAL number 0172 (NOTICESLIDES-295, slice C of the notice board); the integrator renumbers at merge. Nothing else refers to the
-- number. Self-contained and idempotent (IF NOT EXISTS): a second run changes nothing.
--
-- Promo / info slides of the TV boards and the building photo of template 2 (CR-NOTICE106 section 8.3 / 8.4, owner answer 281: one slide may
-- be shown on several boards). `notice_slides` holds the slide (text + the optional picture, already re-encoded by the upload pipeline;
-- the picture is base64 text like brand_assets so it travels as JSON); `notice_board_slides` links a slide to a board with a position.
-- `kind = 'photo'` is the building photo of ONE board (linked to that board only, at most one per board); it never counts as a slide.
-- The module switch `notices.enabled` stays OFF by default. Rollback: drop the two tables (nothing else refers to them).

CREATE TABLE IF NOT EXISTS notice_slides (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL DEFAULT 'slide' CHECK (kind IN ('slide', 'photo')),
  title       TEXT NOT NULL DEFAULT '',                         -- <= 80, plain text
  body        TEXT NOT NULL DEFAULT '',                         -- <= 300, plain text
  seconds     INTEGER,                                          -- seconds on the TV (NULL = the board's rotation interval)
  image_mime  TEXT,                                             -- image/jpeg | image/png (NULL = no picture)
  image_b64   TEXT,                                             -- the sanitised picture, base64
  image_stamp TEXT,                                             -- short hash of the picture (cache key in the feed URL)
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_by  TEXT,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notice_board_slides (
  board_id TEXT NOT NULL REFERENCES notice_boards(id),
  slide_id TEXT NOT NULL REFERENCES notice_slides(id),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (board_id, slide_id)
);
CREATE INDEX IF NOT EXISTS idx_notice_board_slides_slide ON notice_board_slides (slide_id);
