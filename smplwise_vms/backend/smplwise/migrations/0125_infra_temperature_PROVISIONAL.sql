-- CR-INFRA-TEMPERATURE 2.9.1: temperature control under Infrastructure (docs/changes/CR-INFRA-TEMPERATURE.md).
-- NUMBERING: built as PROVISIONAL 0125 on pilot/TEMPCTL-291 (other 2.9.1 branches add migrations too); the lead renumbers the file at the
-- 2.9.1 integration to keep the sequence contiguous. Nothing in the code refers to the number.
--
-- A unit is a fridge, freezer, cold room or any watched space: ONE temperature source - a sensor (sensor.*, numeric) or a climate entity
-- (climate.*: air conditioner / HVAC controller / thermostat - current temperature, setpoint, mode, action; owner 2026-10-19) - an optional door sensor
-- (binary_sensor.*, optionally inverted), a target band (low..high), rule overrides over the installation defaults and a defrost mode.
-- Everything here is written from the state mirror (ha_entities) by services/temperature_runtime.py; nothing is ever sent to a device.
-- No row in infra_temp_units = the feature is absent (no tab for operators, no home tile).

CREATE TABLE infra_temp_units (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  name_key        TEXT NOT NULL,                     -- casefolded, trimmed name: one unit per name
  area_id         TEXT,                              -- ha_areas.area_id (optional)
  kind            TEXT NOT NULL DEFAULT 'fridge',    -- the icon: fridge | freezer | coldroom | pharma | server | room (closed list in code)
  temp_entity_id  TEXT NOT NULL,                     -- sensor.* (numeric, degrees) OR climate.* (current_temperature + setpoint); ids only for infra.temperature.manage
  door_entity_id  TEXT,                              -- binary_sensor.* (optional)
  door_invert     INTEGER NOT NULL DEFAULT 0,        -- 1 = the sensor's `on` means CLOSED
  low             REAL NOT NULL,                     -- the target band, degrees C (band_mode fixed; the fallback while a setpoint is unknown)
  high            REAL NOT NULL,
  band_mode       TEXT NOT NULL DEFAULT 'fixed',     -- fixed | setpoint (climate units only: setpoint +/- the `setpoint_tolerance` rule)
  rules_json      TEXT NOT NULL DEFAULT '{}',        -- per-unit overrides of the installation defaults (absent key = inherit; services/temperature.py RULE_KEYS)
  recipients_json TEXT,                              -- NULL = the installation's routing; else {"roles": [], "users": [], "groups": []} for this unit
  defrost_mode    TEXT NOT NULL DEFAULT 'learn',     -- fixed | learn | none (owner 2026-10-19: optional; learn when no window is entered)
  defrost_json    TEXT NOT NULL DEFAULT '[]',        -- fixed windows: [{"start": "HH:MM" local, "minutes": int}]
  muted_until     TEXT,                              -- ISO UTC; mutes WARNING notifications only (alarms are never silenced)
  muted_by        TEXT,                              -- users.id
  sort_order      INTEGER NOT NULL DEFAULT 0,
  enabled         INTEGER NOT NULL DEFAULT 1,
  revision        INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_infra_temp_units_name ON infra_temp_units (name_key);
CREATE INDEX idx_infra_temp_units_temp ON infra_temp_units (temp_entity_id);

-- The installation defaults of every rule (ONE row; absent = the code defaults). Each unit may override any key.
CREATE TABLE infra_temp_settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  rules_json  TEXT NOT NULL DEFAULT '{}',
  row_version INTEGER NOT NULL DEFAULT 1,
  updated_by  TEXT,
  updated_at  TEXT
);

-- One sample per minute while the reading is live (a gap = no live reading: never an invented value). flags: 1 = inside a defrost window,
-- 2 = the door was open. Kept 35 days (services/temperature.py RAW_KEEP_S).
CREATE TABLE infra_temp_samples (
  unit_id TEXT NOT NULL,
  ts      INTEGER NOT NULL,                          -- unix seconds, minute-aligned (UTC)
  v       REAL NOT NULL,
  sp      REAL,                                      -- the climate unit's setpoint at that minute (NULL for a sensor unit)
  flags   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (unit_id, ts)
) WITHOUT ROWID;

-- The five-minute rollup, kept for `retention_days` (default 400: a year of audits). n_def = samples of the bucket inside a defrost window.
CREATE TABLE infra_temp_samples_5m (
  unit_id TEXT NOT NULL,
  ts      INTEGER NOT NULL,
  v_avg   REAL NOT NULL,
  v_min   REAL NOT NULL,
  v_max   REAL NOT NULL,
  n       INTEGER NOT NULL,
  n_def   INTEGER NOT NULL DEFAULT 0,
  sp_avg  REAL,                                      -- the mean setpoint of the bucket (climate units)
  sp_n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (unit_id, ts)
) WITHOUT ROWID;

-- Door openings (closed_at NULL = open now). opened_at is the sensor's own last change when known.
CREATE TABLE infra_temp_doors (
  unit_id   TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  PRIMARY KEY (unit_id, opened_at)
);

-- The alert log: one row per condition (an excursion above / below the band, a long door opening, a sensor that does not report, a learned
-- defrost cycle) and per operator act (acknowledge, mute). An excursion is ONE row whose severity rises: warned_at, then alarmed_at.
-- suppressed: why its notification was held (quiet | mute | defrost | maintenance | off) - the row is always logged.
CREATE TABLE infra_temp_events (
  id              TEXT PRIMARY KEY,
  unit_id         TEXT NOT NULL,
  kind            TEXT NOT NULL,                     -- high | low | door | offline | defrost | ack | mute
  severity        TEXT NOT NULL,                     -- info | warning | alarm
  started_at      TEXT NOT NULL,
  warned_at       TEXT,
  alarmed_at      TEXT,
  ended_at        TEXT,
  value           REAL,                              -- the latest reading while open, the last one when closed
  peak            REAL,                              -- the most extreme reading of the excursion
  threshold       REAL,
  notification_id TEXT,                              -- the open notification of the current severity (NULL = none)
  suppressed      TEXT,
  ack_by          TEXT,                              -- users.id (the name is read on display)
  ack_at          TEXT,
  detail_json     TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_infra_temp_events_unit ON infra_temp_events (unit_id, started_at);
CREATE INDEX idx_infra_temp_events_started ON infra_temp_events (started_at);
CREATE INDEX idx_infra_temp_events_open ON infra_temp_events (ended_at);

-- Defrost windows learned from the data (mode `learn`): minute of the local day, length, how often seen; status learned | confirmed | rejected.
-- A rejected window is never suggested again (within the clustering tolerance) until the learned set is cleared.
CREATE TABLE infra_temp_defrost_learned (
  unit_id    TEXT NOT NULL,
  start_min  INTEGER NOT NULL,                       -- 0..1439, local wall clock of the installation zone
  minutes    INTEGER NOT NULL,
  repeats    INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'learned',
  first_seen TEXT,
  last_seen  TEXT,
  decided_by TEXT,
  decided_at TEXT,
  PRIMARY KEY (unit_id, start_min)
);

-- Per unit, the learner's own state (learning | learned | none_found) and when it last ran.
CREATE TABLE infra_temp_defrost_state (
  unit_id    TEXT PRIMARY KEY,
  state      TEXT NOT NULL,
  ran_at     TEXT NOT NULL,
  days       REAL NOT NULL DEFAULT 0,                -- how many days of samples the last run saw
  episodes   INTEGER NOT NULL DEFAULT 0
);

-- The temperature alert routing (ONE row): per alert kind (alarm | warning | offline) on / off, recipients and channels. Mirrored onto the
-- CR-018 policy of each source `temperature.<kind>` (services/temperature_alerts.py).
CREATE TABLE infra_temp_alert_settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  kinds_json  TEXT NOT NULL DEFAULT '{}',
  row_version INTEGER NOT NULL DEFAULT 1,
  updated_by  TEXT,
  updated_at  TEXT
);

-- Phase 2: the WhatsApp report (TEXT SUMMARY ONLY for now, owner decision 2026-10-19; services/temperature_whatsapp.py). A row keeps the
-- REQUEST, never the text or a phone number; the text is rebuilt from the data at send time. recipient_kind: user today; vendor is reserved
-- (it needs the tickets message-queue migration the owner deferred - docs/changes/CR-INFRA-TEMPERATURE.md section 9).
CREATE TABLE infra_temp_report_sends (
  id             TEXT PRIMARY KEY,
  batch_id       TEXT NOT NULL,
  schedule_id    TEXT,
  recipient_kind TEXT NOT NULL DEFAULT 'user',      -- user | vendor (reserved)
  user_id        TEXT,
  contact_id     TEXT,                              -- ticket_contacts.id of a vendor (reserved)
  request_json   TEXT NOT NULL,                     -- {"units": [...], "from": ts, "to": ts, "lang": "he"}
  status         TEXT NOT NULL DEFAULT 'queued',    -- queued | held | retry | sent | failed | skipped
  reason         TEXT,                              -- send_hours | no_address | no_consent | no_reach | rate_limited | channel_unavailable | ...
  not_before     TEXT NOT NULL,
  attempts       INTEGER NOT NULL DEFAULT 0,
  created_by     TEXT,
  created_at     TEXT NOT NULL,
  finished_at    TEXT
);
CREATE INDEX idx_infra_temp_report_sends_due ON infra_temp_report_sends (status, not_before);
CREATE INDEX idx_infra_temp_report_sends_batch ON infra_temp_report_sends (batch_id);

CREATE TABLE infra_temp_report_schedules (
  id              TEXT PRIMARY KEY,
  units_json      TEXT NOT NULL,
  range_key       TEXT NOT NULL,                     -- 24h | 7d | 30d | week | month | prev_week | prev_month
  lang            TEXT NOT NULL DEFAULT 'he',
  freq            TEXT NOT NULL,                     -- daily | weekly | monthly
  dow             INTEGER,                           -- 0 = Sunday (weekly)
  dom             INTEGER,                           -- 1..28 (monthly)
  at              TEXT NOT NULL,                     -- HH:MM local
  recipients_json TEXT NOT NULL,                     -- [{"kind": "user", "id": ...}] (vendor reserved)
  enabled         INTEGER NOT NULL DEFAULT 1,
  created_by      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  last_run_at     TEXT,
  next_run_at     TEXT NOT NULL
);
