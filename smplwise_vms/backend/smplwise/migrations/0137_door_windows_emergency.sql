-- Final number 0137 (built as PROVISIONAL 0130 on pilot/DOORWIN-295; renumbered at the 2.10.2 integration, integ/2102: DATASTORE took 0136 after 0135).
-- the content does not depend on the number.
--
-- CR-039 (door windows and emergency door controls) - the Arx side, docs/changes/CR-DOORWIN-295-BUILD-NOTES.md. Shipped OFF: nothing
-- here is written while `doors.windows.enabled` / `doors.emergency.enabled` are off (both default off), and the live engines are refused
-- in this build (services/door_windows_engine.GO_LIVE_PERMITTED is False). Drills write incidents with drill = 1 and never reach an engine.
--
-- Ids, door keys (WisKey station id + relay index), wall-clock times, UTC instants and Arx user ids only. Never a person's name, a PIN,
-- a card, a phone number, a token or a program document beyond its sha. Every instant is ISO-8601 UTC text ending in Z (db.now_iso).
-- Rollback: additive (new tables only); older code ignores them.

CREATE TABLE door_window_rules (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,                                   -- <= 60 characters, shown on screens
  kind            TEXT NOT NULL CHECK (kind IN ('weekly','once','event')),   -- 'event' reserved (CR-039 9, slice W4: not built)
  state           TEXT NOT NULL CHECK (state IN ('draft','enabled','paused','retired')),
  calendar_policy TEXT NOT NULL DEFAULT 'skip_holidays' CHECK (calendar_policy IN ('skip_holidays','holidays_like_friday','ignore_calendar')),
  notes           TEXT,
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_by      TEXT,
  updated_at      TEXT,
  approved_by     TEXT,                                            -- the person whose enabling write covers the live revision (CR-033 6.4)
  approved_at     TEXT,
  revision        INTEGER NOT NULL DEFAULT 1,
  retired_at      TEXT
);

CREATE TABLE door_window_rule_doors (                              -- explicit doors only: no "all doors" wildcard (CR-039 7.4)
  rule_id         TEXT NOT NULL REFERENCES door_window_rules(id) ON DELETE CASCADE,
  station_id      TEXT NOT NULL,
  relay           INTEGER NOT NULL,
  PRIMARY KEY (rule_id, station_id, relay)
);

CREATE TABLE door_window_periods (
  rule_id         TEXT NOT NULL REFERENCES door_window_rules(id) ON DELETE CASCADE,
  weekday         INTEGER CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),   -- 0 = Sunday .. 6 = Saturday; NULL for 'once'
  on_date         TEXT,                                            -- 'YYYY-MM-DD' for 'once'
  start_hm        TEXT NOT NULL,                                   -- 'HH:MM'
  end_hm          TEXT NOT NULL,                                   -- 'HH:MM' or '24:00'; end > start, no overnight period
  CHECK ((weekday IS NULL) <> (on_date IS NULL))
);
CREATE INDEX idx_dwp_rule ON door_window_periods (rule_id);

CREATE TABLE door_window_rule_versions (
  rule_id         TEXT NOT NULL,
  revision        INTEGER NOT NULL,
  document        TEXT NOT NULL,                                   -- the rule as saved (doors, periods, policy): ids and times only
  saved_by        TEXT NOT NULL,
  saved_at        TEXT NOT NULL,
  PRIMARY KEY (rule_id, revision)
);

CREATE TABLE door_window_calendar (                                -- special days (overrides; CR-039 5.4)
  on_date         TEXT NOT NULL,
  scope_key       TEXT NOT NULL DEFAULT '*',                       -- '*' = installation-wide; else a station id
  day_type        TEXT NOT NULL CHECK (day_type IN ('holiday','holiday_eve','regular','closed')),
  label           TEXT,
  set_by          TEXT NOT NULL,
  set_at          TEXT NOT NULL,
  PRIMARY KEY (on_date, scope_key)
);

CREATE TABLE door_window_door_flags (                              -- CR-039 13: a door the administrator marked exterior (owner: interior first)
  station_id      TEXT NOT NULL,
  relay           INTEGER NOT NULL,
  exterior        INTEGER NOT NULL DEFAULT 0,
  set_by          TEXT NOT NULL,
  set_at          TEXT NOT NULL,
  PRIMARY KEY (station_id, relay)
);

-- One row per planned hold-open of one door. The durable plan AND the durable close intent (retries, next_retry_at): the watchdog
-- resumes from here after a restart. Arx never opens a door from these rows (CR-039 SR-1); it only confirms and retries the CLOSE.
CREATE TABLE door_window_occurrences (
  id              TEXT PRIMARY KEY,
  rule_id         TEXT REFERENCES door_window_rules(id),
  station_id      TEXT NOT NULL,
  relay           INTEGER NOT NULL,
  start_at        TEXT NOT NULL,
  end_at          TEXT NOT NULL,
  zone            TEXT NOT NULL,                                   -- the IANA zone the occurrence was computed in
  token           TEXT NOT NULL,                                   -- WisKey's window token 'YYYY-MM-DD/HH:MM/HH:MM' (CR-039 4.5)
  origin          TEXT NOT NULL CHECK (origin IN ('weekly','once')),
  tier            TEXT NOT NULL CHECK (tier IN ('program','prepared')),
  state           TEXT NOT NULL,                                   -- services/door_windows.OCC_STATES
  started_confirmed_at TEXT,
  ended_confirmed_at   TEXT,
  unconfirmed_at  TEXT,                                            -- when the relock became unconfirmed (the alarm's start)
  retries         INTEGER NOT NULL DEFAULT 0,                      -- close-direction attempts made (bounded)
  next_retry_at   TEXT,                                            -- the next close-direction attempt; NULL = none planned
  last_raised_at  TEXT,                                            -- the last time the critical notification was (re-)raised
  last_reason     TEXT,                                            -- a short code: engine_status | feed_unavailable | ...
  resolved_by     TEXT,
  resolved_at     TEXT,
  resolution      TEXT,                                            -- engine_idle | manual_checked | override | emergency
  checked         TEXT,                                            -- manual resolution: 'camera' | 'door'
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (station_id, relay, token)
);
CREATE INDEX idx_dwo_state ON door_window_occurrences (state);
CREATE INDEX idx_dwo_door_time ON door_window_occurrences (station_id, relay, start_at);

CREATE TABLE door_window_engine (                                  -- what Arx last compiled / wrote / read per door
  station_id      TEXT NOT NULL,
  relay           INTEGER NOT NULL,
  tier            TEXT NOT NULL,
  program_revision INTEGER,
  compiled_sha256 TEXT,
  written_sha256  TEXT,                                            -- the sha the engine confirmed (NULL = never written / unknown)
  written_at      TEXT,
  written_by      TEXT,
  last_status     TEXT,
  last_status_at  TEXT,
  foreign_program INTEGER NOT NULL DEFAULT 0,                      -- 1: a program not made by Arx exists - never overwritten
  paused_until    TEXT,                                            -- an override / emergency keeps the program paused until then
  last_error      TEXT,
  PRIMARY KEY (station_id, relay)
);

CREATE TABLE door_emergency_incidents (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('lock_secure','open')),
  scope_type      TEXT NOT NULL CHECK (scope_type IN ('installation','site','building')),
  scope_id        TEXT NOT NULL,
  drill           INTEGER NOT NULL DEFAULT 0,                      -- 1 = drill: the simulated engine only, never a real send
  state           TEXT NOT NULL,                                   -- applying | in_effect | in_effect_partial | releasing | released | released_partial
  reason          TEXT,                                            -- <= 200 characters typed by the presser
  actor_kind      TEXT NOT NULL DEFAULT 'person' CHECK (actor_kind IN ('person','automation')),
  requested_by    TEXT NOT NULL,
  requested_at    TEXT NOT NULL,
  request_id      TEXT NOT NULL UNIQUE,
  released_by     TEXT,
  released_at     TEXT,
  release_request_id TEXT,
  superseded_by   TEXT,                                            -- an OPEN that released this LOCK in one step (CR-039 8.3)
  doors_total     INTEGER NOT NULL,
  doors_ok        INTEGER NOT NULL DEFAULT 0,
  doors_failed    INTEGER NOT NULL DEFAULT 0,
  doors_unknown   INTEGER NOT NULL DEFAULT 0,
  first_sent_ms   INTEGER,                                         -- ms from the confirmation to the first door command (latency evidence)
  last_sent_ms    INTEGER
);
CREATE INDEX idx_dei_state ON door_emergency_incidents (state);
CREATE INDEX idx_dei_requested ON door_emergency_incidents (requested_by, requested_at);

CREATE TABLE door_emergency_doors (
  incident_id     TEXT NOT NULL REFERENCES door_emergency_incidents(id) ON DELETE CASCADE,
  station_id      TEXT NOT NULL,
  relay           INTEGER NOT NULL,
  phase           TEXT NOT NULL CHECK (phase IN ('apply','release')),
  state           TEXT NOT NULL CHECK (state IN ('pending','sent','acknowledged','refused','unknown','skipped')),
  code            TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_at         TEXT,                                            -- the next bounded retry of an unknown outcome (E-1 for OPEN)
  last_at         TEXT,
  settled_at      TEXT,
  PRIMARY KEY (incident_id, station_id, relay, phase)
);

-- The two-step confirmation (T17): a single-use, user-bound, short-lived token. Only its SHA-256 is stored.
CREATE TABLE door_emergency_confirmations (
  token_sha256    TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('start','release')),
  kind            TEXT NOT NULL,
  scope_type      TEXT NOT NULL,
  scope_id        TEXT NOT NULL,
  incident_id     TEXT,
  drill           INTEGER NOT NULL DEFAULT 0,
  doors_total     INTEGER NOT NULL,
  created_at      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  used_at         TEXT
);

CREATE TABLE door_emergency_attestation (                         -- CR-039 8.9: the life-safety acknowledgement before OPEN can be enabled
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  accepted_by     TEXT NOT NULL,
  accepted_at     TEXT NOT NULL,
  text_sha256     TEXT NOT NULL,
  version         INTEGER NOT NULL
);
