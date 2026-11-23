-- MULTI-BUILDING-HOME-2500 (owner decisions 22.11, Q65 and Q68): two display-only building columns, both NULL by default.
--
-- home_interface_policy.building_id: the building a person's home interface opens on, set by an administrator per person (Q65).
--   NULL = not set: the home interface opens on the building last chosen on that device, else the first one. It is a display
--   preference like `site_entry_building`: it never grants or narrows a permission (the server never reads it in ha_scope /
--   building_scope). A deleted building reads as not set.
-- notice_boards.building_id: the building a lobby board belongs to (Q68). NULL = the whole site (the greeting chain of before). The
--   board's feed greets with that building's name while the multi-building switch is on; which notices a board shows is unchanged
--   (tagged to the board).
--
-- Additive only. Rollback: an older version ignores both columns. The number is taken at train integration (0217 is used by
-- ONVIF-CLIENT-2500 / ONVIF-UI-2500).
ALTER TABLE home_interface_policy ADD COLUMN building_id TEXT;
ALTER TABLE notice_boards ADD COLUMN building_id TEXT;
