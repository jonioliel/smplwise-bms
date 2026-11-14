-- CR-029 S3 (Plan Studio 6 stills, room masks and the lightmap bake; docs/changes/CR-029-ST7-S3-NOTES.md): the files an editor's
-- browser renders per floor and uploads (the add-on has no 3D renderer), keyed by the floor's bake key (published structure
-- doc_hash + rooms + catalog revision). One row per slot; a new upload replaces the slot's file. `path` is relative to the data
-- directory under plans/bakes/<floor id>/ (services/plan_bakes.confine), in every backup (services/backup.PROJECT_TABLES /
-- FILE_COLUMNS), deleted with the floor. The jobs table holds the regenerate requests an editor session picks up (runtime state:
-- not backed up). Additive: the previous version ignores both tables (rollback = leave them; the files are under plans/).
CREATE TABLE plan_bakes (
  id           TEXT PRIMARY KEY,
  floor_id     TEXT NOT NULL,
  level_id     TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('still', 'mask', 'lightmap')),
  preset       TEXT NOT NULL DEFAULT '',
  style        TEXT NOT NULL DEFAULT '',
  band         TEXT NOT NULL DEFAULT '',
  variant      TEXT NOT NULL DEFAULT '',
  bake_key     TEXT NOT NULL,
  recipe       TEXT NOT NULL,
  path         TEXT NOT NULL,
  mime         TEXT NOT NULL,
  width        INTEGER NOT NULL DEFAULT 0,
  height       INTEGER NOT NULL DEFAULT 0,
  bytes        INTEGER NOT NULL,
  sha256       TEXT NOT NULL,
  meta_json    TEXT NOT NULL DEFAULT '{}',
  created_by   TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (floor_id, level_id, kind, preset, style, band, variant)
);
CREATE INDEX plan_bakes_floor ON plan_bakes(floor_id, bake_key);

CREATE TABLE plan_bake_jobs (
  id            TEXT PRIMARY KEY,
  floor_id      TEXT NOT NULL,
  bake_key      TEXT NOT NULL,
  scope_json    TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('requested', 'claimed', 'done', 'failed', 'cancelled')),
  requested_by  TEXT,
  requested_at  TEXT NOT NULL,
  claimed_by    TEXT,
  claimed_at    TEXT,
  lease_until   TEXT,
  finished_at   TEXT,
  error         TEXT
);
CREATE INDEX plan_bake_jobs_floor ON plan_bake_jobs(floor_id, status);
