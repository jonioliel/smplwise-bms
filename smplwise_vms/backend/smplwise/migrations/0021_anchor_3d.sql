-- Plan Studio phase 4 (T087, CR-003, design 4.1): the height of a placed item above its level's floor and its downward
-- tilt, for the schematic 3D view. NULL = the default of the item's kind (camera 2.5 m / 10 deg down, door station
-- 1.4 m / 0, other entities 1.2 m / 0), applied by the clients and never stored.
ALTER TABLE map_anchors ADD COLUMN mount_height_m REAL;
ALTER TABLE map_anchors ADD COLUMN tilt_deg REAL;
