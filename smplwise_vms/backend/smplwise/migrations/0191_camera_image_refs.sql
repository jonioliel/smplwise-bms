-- PROVISIONAL number 0191 (CAMHEALTH091-295, board r091, docs/changes/CR-CAMHEALTH091.md). main ends at 0151 and release/2150 uses 0152+;
-- this file is renumbered to the next free number at the integration of the release that takes it.
--
-- Camera image health: the REFERENCE view of each camera for the "shifted" check - a 64 x 48 grayscale thumbnail (3 KB of raw bytes, row
-- major), never a full picture. The first usable sample becomes the reference automatically (`auto` = 1); an administrator may set it again
-- or clear it (`set_by` = the user id, audited). Everything else the feature knows (metrics, streaks) is in memory only.
-- Rollback: additive only (one new table); older code ignores it.

CREATE TABLE camera_image_refs (
  camera_id  TEXT PRIMARY KEY,
  width      INTEGER NOT NULL CHECK (width > 0 AND width <= 256),
  height     INTEGER NOT NULL CHECK (height > 0 AND height <= 256),
  thumb      BLOB NOT NULL,
  set_at     TEXT NOT NULL,
  set_by     TEXT,
  auto       INTEGER NOT NULL DEFAULT 1 CHECK (auto IN (0, 1))
);
