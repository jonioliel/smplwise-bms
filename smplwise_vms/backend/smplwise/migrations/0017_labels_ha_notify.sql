-- R4 (0.1.73): where the name label sits relative to a room / a placed item (auto | top | bottom | left | right).
ALTER TABLE spatial_zones ADD COLUMN label_pos TEXT;
ALTER TABLE map_anchors ADD COLUMN label_pos TEXT;
