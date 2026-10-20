-- CR-INFRA-TEMPERATURE phase 3 (2.9.3): the accepted improvement ideas (docs/changes/CR-INFRA-TEMPERATURE.md section 11).
-- NUMBERING: PROVISIONAL 0126 on pilot/TEMPCTL3-293 (2.9.2 integration uses 0124-0125; the phase 1-2 file is 0125_infra_temperature_PROVISIONAL);
-- the lead renumbers this file at integration to keep the sequence contiguous. Nothing in the code refers to the number. It needs the
-- tables of 0125_infra_temperature_PROVISIONAL (ALTERs only + two new tables).
--
-- Everything is still read-only against the infrastructure: the power reading of a smart plug / current meter is READ, never switched.

-- Compressor duty cycle (idea 6): an optional power sensor of the unit (sensor.*, W / kW) read every minute next to the temperature.
ALTER TABLE infra_temp_units ADD COLUMN power_entity_id TEXT;            -- sensor.* power (W or kW); NULL = no duty cycle
-- Maintenance window (idea 9): who, why and until when; holds the unit's WARNINGS (alarms only with `maintenance_includes_alarms`).
ALTER TABLE infra_temp_units ADD COLUMN maint_until TEXT;                -- ISO UTC; NULL / past = not in maintenance
ALTER TABLE infra_temp_units ADD COLUMN maint_by TEXT;                   -- users.id
ALTER TABLE infra_temp_units ADD COLUMN maint_reason TEXT;               -- free text (cleaning, restocking, technician ...), at most 120 characters
ALTER TABLE infra_temp_units ADD COLUMN maint_event_id TEXT;             -- the open `maint` row of the alert log

-- the minute sample: the power reading (W) of the power sensor at that minute (NULL = none / no power sensor)
ALTER TABLE infra_temp_samples ADD COLUMN pw REAL;
-- the five-minute rollup: minutes with a power reading and minutes the compressor was on (power >= `compressor_on_w`)
ALTER TABLE infra_temp_samples_5m ADD COLUMN pw_n INTEGER NOT NULL DEFAULT 0;
ALTER TABLE infra_temp_samples_5m ADD COLUMN on_n INTEGER NOT NULL DEFAULT 0;

-- the alert log: the escalation chain (idea 4) and the service ticket opened from the row (idea 11, both directions)
ALTER TABLE infra_temp_events ADD COLUMN escalation_level INTEGER NOT NULL DEFAULT 0;  -- how many steps of the chain were reached
ALTER TABLE infra_temp_events ADD COLUMN escalated_at TEXT;
ALTER TABLE infra_temp_events ADD COLUMN ticket_id TEXT;                                -- tickets.id opened from this row (NULL = none)

-- the escalation chain of the alert routing (system.configure): {"enabled": true, "channels": [...], "steps": [{"after_min", "recipients"}]}
ALTER TABLE infra_temp_alert_settings ADD COLUMN escalation_json TEXT NOT NULL DEFAULT '{}';

-- Per unit, the derived insights (recomputed hourly by services/temperature_insights.py from the stored history; never a reading):
-- door <-> temperature correlation and recovery time (idea 2), compressor duty cycle (idea 6), sensor health (idea 8).
CREATE TABLE infra_temp_insights (
  unit_id     TEXT PRIMARY KEY,
  data_json   TEXT NOT NULL DEFAULT '{}',
  computed_at TEXT NOT NULL
);

-- The service tickets opened from a unit (idea 11): the unit's side of the two-way link (the ticket keeps the unit in its timeline note).
CREATE TABLE infra_temp_tickets (
  ticket_id  TEXT PRIMARY KEY,
  unit_id    TEXT NOT NULL,
  event_id   TEXT,                                     -- infra_temp_events.id (NULL = opened from the unit, not from a row)
  number     INTEGER,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_infra_temp_tickets_unit ON infra_temp_tickets (unit_id, created_at);
