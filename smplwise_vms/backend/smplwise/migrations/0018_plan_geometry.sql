-- Plan Studio phase 1 (T084, CR-003): the structure layer of each plan version. One draft row per version (the
-- editor's autosave target), at most one published row, and the archived history the historical map reads.
-- doc_json is the canonical v2 document (services/plan_geometry.py); doc_hash its SHA-256, which the map bundle
-- carries instead of the document and which serves as the ETag.
CREATE TABLE plan_geometry (
  id              TEXT PRIMARY KEY,
  plan_version_id TEXT NOT NULL REFERENCES plan_versions(id),
  floor_id        TEXT NOT NULL REFERENCES floors(id),
  status          TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  revision        INTEGER NOT NULL DEFAULT 1,
  doc_json        TEXT NOT NULL,
  doc_hash        TEXT NOT NULL,
  created_by      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  published_by    TEXT,
  published_at    TEXT,
  archived_at     TEXT
);
CREATE INDEX idx_plan_geometry_version ON plan_geometry (plan_version_id, status);
CREATE UNIQUE INDEX idx_plan_geometry_one_draft ON plan_geometry (plan_version_id) WHERE status = 'draft';
CREATE UNIQUE INDEX idx_plan_geometry_one_published ON plan_geometry (plan_version_id) WHERE status = 'published';
-- The two-point calibration record of a version (pairs, method, residual); the scale itself stays in scale_m_per_px.
ALTER TABLE plan_versions ADD COLUMN calibration_json TEXT;
