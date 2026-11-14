-- CAMERA-STREAM-SOURCES-2410 (owner decision 08.11, docs/changes/CAMERA-STREAM-SOURCES-2410.md): a camera's video source.
-- No row = the camera's video comes from its recorder, exactly as before. A row = the owner typed the camera's own RTSP addresses
-- ("manual address"): live video and snapshots come from those addresses through go2rtc streams `smplwise_cam_<camera id>_<main|sub>`
-- (services/camera_sources.py). A camera without a recorder (recorder id `standalone`, created with the first such camera) always has
-- a row.
-- Secrets: each address may carry the camera's user and password, so the FULL address is stored only sealed (`*_url_enc`: AES-256-GCM
-- with the per-install key of recorder_connections, associated data `camera_source|<camera id>|<main|sub>`; a blob moved to another
-- camera, profile or table does not open). `*_display` is the address with the password masked (`rtsp://user:***@host/path`): the only
-- form any answer, log or audit row ever carries. Not a backup table (the recorder_connections precedent): an archive never carries a
-- sealed blob to another box, and a restore never touches these rows.
-- Number 0209: the next free number on main (0208_wiskey_visit_links.sql); renumber at the train if another branch took it.
-- Additive only; older code never reads it. Rollback: run the previous version (the rows are ignored); drop the table to forget them.

CREATE TABLE IF NOT EXISTS camera_stream_sources (
  camera_id        TEXT PRIMARY KEY,                -- cameras.id (no FK, like every other table that names a camera)
  main_url_enc     TEXT,                            -- the main stream's full address, sealed; NULL = the sub address serves both
  sub_url_enc      TEXT,                            -- the sub stream's full address, sealed; NULL = the main address serves both
  main_display     TEXT,                            -- the main address with its password masked (never a secret)
  sub_display      TEXT,
  main_has_password INTEGER NOT NULL DEFAULT 0,
  sub_has_password  INTEGER NOT NULL DEFAULT 0,
  area_id          TEXT,                            -- a camera without a recorder: the area it belongs to (a home-platform area id), else NULL
  probe_json       TEXT NOT NULL DEFAULT '{}',      -- the last stream test per profile: codec, resolution, when (never an address)
  revision         INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  updated_by       TEXT,
  CHECK (main_url_enc IS NOT NULL OR sub_url_enc IS NOT NULL)
);
