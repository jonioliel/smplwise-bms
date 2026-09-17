-- R2 (0.1.69): manual coverage area per camera anchor - a cone radius as a fraction of the plan width, or a free polygon
-- (JSON [[x, y], ...] normalized to the plan). NULL = the default illustration cone.
ALTER TABLE map_anchors ADD COLUMN coverage_radius REAL;
ALTER TABLE map_anchors ADD COLUMN coverage_polygon TEXT;
