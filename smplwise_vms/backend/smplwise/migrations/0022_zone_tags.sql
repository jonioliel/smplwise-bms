-- Plan Studio (T085, owner request 2026-09-26): free-text tags on a room / zone for marking and later selection, as
-- walls and objects of the structure document carry them. A JSON array of strings; NULL = no tags.
ALTER TABLE spatial_zones ADD COLUMN tags_json TEXT;
