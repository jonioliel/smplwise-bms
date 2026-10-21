-- PROVISIONAL number 0138 (pilot/DOORWIN2-295, built on integ/2102 whose last file is 0137_door_windows_emergency.sql). The lead renumbers at integration;
-- the content does not depend on the number. Other agents' provisional ranges start at 0140.
--
-- CR-039 slice W4 and the foreign-program rule (docs/changes/CR-DOORWIN2-295-BUILD-NOTES.md): event-triggered windows, their trigger log, and the
-- bookkeeping of a program a person made in the intercom panel that an emergency LOCK paused. Shipped OFF like 0137: nothing is written while
-- `doors.windows.enabled` is off, simulated triggers never reach an engine, and the live engine is refused (GO_LIVE_PERMITTED is False).
--
-- Ids, door keys, wall-clock times, UTC instants and Arx user ids only. NEVER the plaintext trigger token (only its SHA-256), a person's name, a
-- phone, a card or an event payload. Every instant is ISO-8601 UTC text ending in Z (db.now_iso).
-- Rollback: additive except the occurrences table, which is rebuilt with a wider CHECK and the same rows; older code ignores the new tables.

-- ---- 1. occurrences may now come from an event (origin 'event') and remember which trigger started them
ALTER TABLE door_window_occurrences RENAME TO door_window_occurrences_0137;
DROP INDEX idx_dwo_state;
DROP INDEX idx_dwo_door_time;
CREATE TABLE door_window_occurrences (
  id              TEXT PRIMARY KEY,
  rule_id         TEXT REFERENCES door_window_rules(id),            -- NULL for a one-off "open for N hours" started by a person's click
  station_id      TEXT NOT NULL,
  relay           INTEGER NOT NULL,
  start_at        TEXT NOT NULL,
  end_at          TEXT NOT NULL,
  zone            TEXT NOT NULL,
  token           TEXT NOT NULL,
  origin          TEXT NOT NULL CHECK (origin IN ('weekly','once','event')),
  tier            TEXT NOT NULL CHECK (tier IN ('program','prepared')),
  state           TEXT NOT NULL,
  started_confirmed_at TEXT,
  ended_confirmed_at   TEXT,
  unconfirmed_at  TEXT,
  retries         INTEGER NOT NULL DEFAULT 0,
  next_retry_at   TEXT,
  last_raised_at  TEXT,
  last_reason     TEXT,
  resolved_by     TEXT,
  resolved_at     TEXT,
  resolution      TEXT,
  checked         TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  trigger_ref     TEXT,                                             -- event: the HA context id / automation run id (the audit pair)
  UNIQUE (station_id, relay, token)
);
INSERT INTO door_window_occurrences(id, rule_id, station_id, relay, start_at, end_at, zone, token, origin, tier, state, started_confirmed_at, ended_confirmed_at,
    unconfirmed_at, retries, next_retry_at, last_raised_at, last_reason, resolved_by, resolved_at, resolution, checked, created_at, updated_at)
  SELECT id, rule_id, station_id, relay, start_at, end_at, zone, token, origin, tier, state, started_confirmed_at, ended_confirmed_at,
    unconfirmed_at, retries, next_retry_at, last_raised_at, last_reason, resolved_by, resolved_at, resolution, checked, created_at, updated_at
  FROM door_window_occurrences_0137;
DROP TABLE door_window_occurrences_0137;
CREATE INDEX idx_dwo_state ON door_window_occurrences (state);
CREATE INDEX idx_dwo_door_time ON door_window_occurrences (station_id, relay, start_at);

-- ---- 2. the trigger of an event rule (kind = 'event'): what starts it and how often (CR-039 9)
CREATE TABLE door_window_triggers (
  rule_id         TEXT PRIMARY KEY REFERENCES door_window_rules(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('arx_automation','ha_event')),
  duration_s      INTEGER NOT NULL CHECK (duration_s BETWEEN 60 AND 43200),
  automation_id   TEXT,                                             -- arx_automation: the HA automation entity the trigger matches
  item_revision   TEXT,                                             -- arx_automation: the live revision the approver saw (a different one is refused)
  token_sha256    TEXT,                                             -- ha_event: SHA-256 of the per-rule secret (shown once at creation / regeneration)
  token_set_at    TEXT,
  allowed_from_hm TEXT,                                             -- the daily window inside which a trigger may start an occurrence
  allowed_to_hm   TEXT,
  max_per_day     INTEGER NOT NULL DEFAULT 1 CHECK (max_per_day BETWEEN 1 AND 6),
  cooldown_s      INTEGER NOT NULL DEFAULT 900 CHECK (cooldown_s BETWEEN 0 AND 86400),
  authorising_actor TEXT NOT NULL,                                  -- the person whose approval covers the rule; re-checked at fire time (CR-033 6.4)
  arm_state       TEXT NOT NULL DEFAULT 'simulate' CHECK (arm_state IN ('simulate','armed'))   -- 'armed' only with the automation actor (fail closed)
);

-- ---- 3. every trigger decision, durable: the caps (per day, cooldown, storm) are counted from here and survive a restart
CREATE TABLE door_window_trigger_log (
  id              TEXT PRIMARY KEY,
  at              TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('arx_button','arx_automation','ha_event')),
  rule_id         TEXT,
  station_id      TEXT,
  relay           INTEGER,
  decision        TEXT NOT NULL CHECK (decision IN ('started','extended','simulated','refused')),
  reason          TEXT,                                             -- a short code: outside_hours | cooldown | daily_cap | storm | relock_unconfirmed | ...
  trigger_ref     TEXT,
  start_at        TEXT,
  end_at          TEXT,
  occurrence_id   TEXT,
  actor           TEXT                                              -- the person (arx_button) or the authorising actor
);
CREATE INDEX idx_dwtl_door ON door_window_trigger_log (station_id, relay, at);
CREATE INDEX idx_dwtl_at ON door_window_trigger_log (at);
-- one delivery of one event is one trigger, however many times it arrives (Home Assistant redelivery, T5)
CREATE UNIQUE INDEX idx_dwtl_ref ON door_window_trigger_log (source, rule_id, station_id, relay, trigger_ref) WHERE trigger_ref IS NOT NULL AND decision <> 'refused';

-- ---- 3b. W-01 (Fable review 2): a guard's cancel of a FUTURE occurrence is part of the compile - the program written to the engine omits that
-- one window (a per-door, per-token exclusion), so the door is not held open at the planned time and the next compile never re-plans it
CREATE TABLE door_window_exclusions (
  station_id      TEXT NOT NULL,
  relay           INTEGER NOT NULL,
  token           TEXT NOT NULL,                                    -- WisKey's window token 'YYYY-MM-DD/HH:MM/HH:MM' of the cancelled window
  excluded_by     TEXT NOT NULL,
  excluded_at     TEXT NOT NULL,
  PRIMARY KEY (station_id, relay, token)
);

-- ---- 4. a foreign program (made in the intercom panel) that an emergency LOCK paused: Arx never re-activates it (CR-039 19.3)
ALTER TABLE door_window_engine ADD COLUMN foreign_paused_incident TEXT;
ALTER TABLE door_window_engine ADD COLUMN foreign_paused_at TEXT;
