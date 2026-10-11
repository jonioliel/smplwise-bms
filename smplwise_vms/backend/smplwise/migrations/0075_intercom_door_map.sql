-- 0075: the WisKey door map (CR-033 slice D1, owner decision 18 = א). One HA lock entity of the WisKey integration ->
-- (station config entry id, relay physical_index). Filled explicitly only - never by name and never by parsing the
-- entity's unique_id: `wiskey_explicit` (the field WisKey provides - not seen yet), `single_relay` (the station has
-- exactly one relay and exactly one WisKey lock entity carries its config entry id) or `manual` (Settings, system
-- administrator, audited intercom.door.mapped). A lock entity without a row is unmapped and refused
-- (`intercom_lock_unmapped`); nothing is sent for it.
CREATE TABLE intercom_door_map (
  entity_id       TEXT PRIMARY KEY,
  config_entry_id TEXT NOT NULL,
  physical_index  INTEGER NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('wiskey_explicit', 'single_relay', 'manual')),
  mapped_by       TEXT,
  mapped_at       TEXT NOT NULL,
  revision        INTEGER NOT NULL DEFAULT 1,
  UNIQUE (config_entry_id, physical_index)
);
