-- 0206 (HA-2026-11-COMPAT-2404): Home Assistant 2026.11 entity names and child devices.
-- ha_entities.name keeps the name Home Assistant shows (composed from the registries, services/ha_naming.py); short_name is
-- the entity's own part (the device's name for a main entity) and main_entity marks HA's "main entity of the device".
-- ha_devices.parent_device_id links a child device to its parent; ha_devices.area_id holds the device's effective area
-- (its own, else its parent's), as Home Assistant resolves it; ha_devices.next_name_part is the child device's own naming link
-- (`parent_device` while it has no area of its own, `area` once it has one).
ALTER TABLE ha_entities ADD COLUMN short_name TEXT;
ALTER TABLE ha_entities ADD COLUMN main_entity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ha_devices ADD COLUMN parent_device_id TEXT;
ALTER TABLE ha_devices ADD COLUMN next_name_part TEXT;
