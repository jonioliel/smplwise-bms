-- 0199 PROVISIONAL (XSCENARIO109-295, docs/changes/CR-SCENARIO109.md sections 5 and 17.5): cross-module scenarios on one condition model.
-- The final number is assigned at integration under the renumbering rule. Additive only: new tables, no change to an existing table.
-- The tables stay empty while `scenarios.enabled` is false (the default). Nothing here contacts a device; a scenario never operates a door.

CREATE TABLE scenario_rules (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  enabled          INTEGER NOT NULL DEFAULT 0,              -- a new rule is created disabled; enabling is its own audited call
  schema_version   INTEGER NOT NULL DEFAULT 1,
  definition_json  TEXT NOT NULL,                           -- {when, actions, options}: services/scenario_model.py validates it
  definition_hash  TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,              -- optimistic concurrency
  owner_user_id    TEXT NOT NULL,                           -- the author whose rights are rechecked at every run (owner Q4 = 270 a)
  service_identity TEXT NOT NULL,                           -- the scenario's own service identity record: 'svc:scenario:<id>' (never a sign-in)
  state            TEXT NOT NULL DEFAULT 'off',             -- off | ok | active | degraded | suppressed
  state_reason     TEXT,                                    -- degraded / suppressed reason code
  state_since      TEXT,
  last_eval_at     TEXT,
  last_result      TEXT,                                    -- TRUE | FALSE | UNKNOWN
  last_fire_at     TEXT,
  fires_day        TEXT,                                    -- the site-local day the counters below belong to
  fires_today      INTEGER NOT NULL DEFAULT 0,
  tickets_today    INTEGER NOT NULL DEFAULT 0,
  created_by       TEXT NOT NULL,
  updated_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX idx_scenario_rules_enabled ON scenario_rules (enabled);

-- Per (rule, leaf): the hold / debounce / hysteresis state, so a restart neither flaps nor re-fires.
CREATE TABLE scenario_leaf_state (
  rule_id          TEXT NOT NULL REFERENCES scenario_rules(id) ON DELETE CASCADE,
  leaf_path        TEXT NOT NULL,
  raw_state        TEXT NOT NULL DEFAULT 'UNKNOWN',
  since            TEXT,
  held_since       TEXT,
  hyst_state       TEXT,
  last_reading_json TEXT,
  PRIMARY KEY (rule_id, leaf_path)
);

CREATE TABLE scenario_flags (
  name             TEXT PRIMARY KEY,
  value            TEXT,                                    -- 'true' / 'false' or one closed enum value; NULL = never set
  set_by_rule      TEXT,
  set_at           TEXT
);

CREATE TABLE scenario_runs (
  id               TEXT PRIMARY KEY,
  rule_id          TEXT NOT NULL,
  rule_version     INTEGER NOT NULL,
  at               TEXT NOT NULL,
  trigger_kind     TEXT NOT NULL,                           -- tick | event | manual_test
  outcome          TEXT NOT NULL,                           -- fired | cleared | suppressed | degraded | test
  result           TEXT NOT NULL,                           -- TRUE | FALSE | UNKNOWN
  snapshot_json    TEXT NOT NULL,
  actions_json     TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_scenario_runs_rule ON scenario_runs (rule_id, at);

CREATE TABLE scenario_versions (
  rule_id          TEXT NOT NULL,
  version          INTEGER NOT NULL,
  definition_json  TEXT NOT NULL,
  name             TEXT NOT NULL,
  at               TEXT NOT NULL,
  by_user          TEXT NOT NULL,
  PRIMARY KEY (rule_id, version)
);
