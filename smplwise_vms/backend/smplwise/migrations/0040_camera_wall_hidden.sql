-- Wall arrangement (owner request 2026-09-30): a camera may be hidden on the all-cameras wall ("לא להציג").
-- Kept beside sort_order / grid_col_span (the same system-wide arrangement, same permission); the camera itself
-- stays reachable from its own page, saved views and investigation. 0 = shown (default), 1 = hidden in the wall.
ALTER TABLE cameras ADD COLUMN wall_hidden INTEGER NOT NULL DEFAULT 0;
