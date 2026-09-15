-- Stylized "SMPLWISE language" rendering per plan version (design M11, local image processing):
-- the map serves the stylized picture when render_mode = 'stylized'; the source image is never modified.
ALTER TABLE plan_versions ADD COLUMN render_mode TEXT NOT NULL DEFAULT 'source';
ALTER TABLE plan_versions ADD COLUMN stylized_path TEXT;
ALTER TABLE plan_versions ADD COLUMN stylize_json TEXT;
