-- 0030 (T050 import): a case can be imported from an evidence bundle of another installation (or of this one, later).
-- cases.origin = 'imported' marks it; provenance_json keeps where the bundle came from (source installation id and
-- version, exporter, export time, the bundle's SHA-256, the verification result at import); import_sha256 is the
-- SHA-256 of the imported ZIP - unique, so the same bundle is never imported twice while its case exists.
-- case_items.origin_json marks an imported item (read-only) with what the bundle said about it: the source camera is a
-- name only - nothing from a bundle becomes a camera, an event, a plan, a user or a setting here.
ALTER TABLE cases ADD COLUMN origin TEXT NOT NULL DEFAULT 'local' CHECK (origin IN ('local', 'imported'));
ALTER TABLE cases ADD COLUMN provenance_json TEXT;
ALTER TABLE cases ADD COLUMN import_sha256 TEXT;
CREATE UNIQUE INDEX idx_cases_import_sha256 ON cases (import_sha256) WHERE import_sha256 IS NOT NULL;
ALTER TABLE case_items ADD COLUMN origin_json TEXT;
