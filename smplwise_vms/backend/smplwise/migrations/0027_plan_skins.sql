-- CR-006 phase 2, slice 2a (AI-rendered floor skins): the render records and the control images.
-- plan_skin_renders: one row per request that was actually sent to an image provider - the record shape 2b/2c reuse
-- for real renders (floor, level, state key, provider, model, prompt version, control-image hash, cost, accepted). In
-- 2a only the owner's connection test writes rows (test = 1, floor_id NULL). Budgets count status = 'ok' rows.
CREATE TABLE plan_skin_renders (
  id                 TEXT PRIMARY KEY,
  floor_id           TEXT,                   -- NULL for the connection test
  level_id           TEXT,
  state_key          TEXT NOT NULL,          -- all_off | all_on | ... | test_pattern
  provider           TEXT NOT NULL,          -- openai
  model              TEXT NOT NULL,
  prompt_version     TEXT NOT NULL,
  control_hash       TEXT NOT NULL,          -- sha256 of the image that was sent
  geometry_key       TEXT,                   -- the floor's geometry key the control image was made from
  sent_plan_raster   INTEGER NOT NULL DEFAULT 0,  -- the sender chose to add the original plan image (CR-006 7.2, per send)
  cost_estimate_usd  REAL,                   -- an estimate, never a charge (the provider's usage is in usage_json)
  status             TEXT NOT NULL,          -- ok | error
  http_status        INTEGER,
  error_code         TEXT,
  usage_json         TEXT,
  image_path         TEXT,                   -- the stored answer under the data dir (2b); NULL for a test
  test               INTEGER NOT NULL DEFAULT 0,
  accepted           INTEGER,                -- NULL undecided, 1 accepted, 0 rejected (kept: it was paid for)
  created_by         TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX idx_plan_skin_renders_created ON plan_skin_renders (created_at);
CREATE INDEX idx_plan_skin_renders_floor ON plan_skin_renders (floor_id, geometry_key);

-- The control image of a floor per synthetic state, uploaded by the browser (its own level-2 isometric render, labels
-- stripped). One row per (floor, state): a new geometry key replaces the older image. Never served to a browser.
CREATE TABLE plan_skin_controls (
  id                 TEXT PRIMARY KEY,
  floor_id           TEXT NOT NULL,
  state_key          TEXT NOT NULL,          -- all_off | all_on
  geometry_key       TEXT NOT NULL,
  sha256             TEXT NOT NULL,
  bytes              INTEGER NOT NULL,
  width              INTEGER NOT NULL,
  height             INTEGER NOT NULL,
  path               TEXT NOT NULL,          -- relative to the data dir
  created_by         TEXT,
  created_at         TEXT NOT NULL,
  UNIQUE (floor_id, state_key)
);
