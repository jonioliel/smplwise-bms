-- DEVTYPE (owner 2026-10-09): the type of a switch-wired device. A plain switch (or a virtual on/off helper) has no type of its
-- own in the infrastructure, so the server guesses it from the display name (services/device_activity.switch_equipment: a
-- boiler word = water heater, a tap / irrigation word = valve, else a switch). An administrator (system.configure) may fix the
-- type per entity in Settings; a row here wins over the guess. No row = automatic. The controls stay the entity's own domain.
CREATE TABLE device_type_override (
  entity_id          TEXT PRIMARY KEY,
  kind               TEXT NOT NULL CHECK (kind IN ('switch', 'outlet', 'light', 'fan', 'heater', 'water_heater', 'valve')),
  set_by             TEXT,
  set_by_username    TEXT,
  set_at             TEXT NOT NULL
);
