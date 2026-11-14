-- Camera grid layout (T091, owner request 2026-09-27): a camera may occupy more than one column of the
-- all-cameras grid (panoramic cameras covering the sports hall); a plain column count, 1-4, default 1.
ALTER TABLE cameras ADD COLUMN grid_col_span INTEGER NOT NULL DEFAULT 1;
