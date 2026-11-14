-- Plan Studio (T084 / T085, CR-003): rooms and placed items belong to a level of the floor (the split-level sports
-- hall); NULL = the floor's default level. A room may override its level's ceiling height.
ALTER TABLE spatial_zones ADD COLUMN level_id TEXT;
ALTER TABLE spatial_zones ADD COLUMN ceiling_height_m REAL;
ALTER TABLE map_anchors ADD COLUMN level_id TEXT;
